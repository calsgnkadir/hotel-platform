package com.hotelapp.service;

import com.hotelapp.dto.ConversationDto;
import com.hotelapp.dto.MessageDto;
import com.hotelapp.dto.MessageRequest;
import com.hotelapp.dto.PageResponse;
import com.hotelapp.dto.StartConversationRequest;
import com.hotelapp.entity.Application;
import com.hotelapp.entity.Conversation;
import com.hotelapp.entity.Message;
import com.hotelapp.entity.User;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.ConversationRepository;
import com.hotelapp.repository.MessageRepository;
import com.hotelapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;

/**
 * #76: Mesajlaşma iş mantığı.
 * - Sohbet 2 kullanıcı arasında (1 CANDIDATE + 1 BUSINESS_OWNER).
 * - Aynı çift için ikinci sohbet açılmaz (idempotent başlatma).
 * - Mesaj atınca karşı tarafa NotificationType.NEW_MESSAGE bildirim.
 * - Sohbete girince o sohbetin "bana gelen" mesajları okundu işaretlenir.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MessageService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;
    private final NotificationService notificationService;
    private final FileStorageService fileStorageService;
    private final SimpMessagingTemplate messagingTemplate;  // FAZ 1/#12 — WS broadcast

    // ----------------------------------------------------------------
    // Sohbet listesi (sayfalı, son mesaja göre azalan)
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public PageResponse<ConversationDto> getMyConversations(Long userId, Pageable pageable) {
        Page<Conversation> page = conversationRepository.findForUser(userId, pageable);
        return PageResponse.of(page, c -> toConversationDto(c, userId));
    }

    // ----------------------------------------------------------------
    // Sohbet aç (yoksa oluştur, varsa mevcudu döndür)
    // ----------------------------------------------------------------
    @Transactional
    public ConversationDto startConversation(Long initiatorId, StartConversationRequest req) {
        User initiator = userRepository.findById(initiatorId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", initiatorId));
        User other = userRepository.findById(req.getOtherPartyId())
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", req.getOtherPartyId()));

        if (initiator.getId().equals(other.getId())) {
            throw new BusinessRuleException("Kendinizle sohbet başlatamazsınız");
        }

        // (candidate, businessOwner) çiftini belirle — rollere göre
        User candidate;
        User businessOwner;
        if (initiator.getRole() == Role.CANDIDATE && other.getRole() == Role.BUSINESS_OWNER) {
            candidate = initiator;
            businessOwner = other;
        } else if (initiator.getRole() == Role.BUSINESS_OWNER && other.getRole() == Role.CANDIDATE) {
            candidate = other;
            businessOwner = initiator;
        } else {
            throw new BusinessRuleException(
                    "Sohbet yalnızca bir aday ile bir işletme sahibi arasında olabilir");
        }

        // Var mı?
        Conversation conv = conversationRepository
                .findByCandidateIdAndBusinessOwnerId(candidate.getId(), businessOwner.getId())
                .orElseGet(() -> {
                    Application application = null;
                    if (req.getApplicationId() != null) {
                        application = applicationRepository.findById(req.getApplicationId())
                                .orElseThrow(() -> new ResourceNotFoundException(
                                        "Başvuru", req.getApplicationId()));
                        // Güvenlik: başvuru gerçekten bu iki tarafa mı ait?
                        Long appCandidateId = application.getCandidate().getId();
                        Long appOwnerId = application.getJobListing().getBusiness().getOwner().getId();
                        if (!appCandidateId.equals(candidate.getId())
                                || !appOwnerId.equals(businessOwner.getId())) {
                            throw new BusinessRuleException(
                                    "Başvuru bu iki tarafa ait değil");
                        }
                    }
                    Conversation c = Conversation.builder()
                            .candidate(candidate)
                            .businessOwner(businessOwner)
                            .application(application)
                            .build();
                    return conversationRepository.save(c);
                });

        return toConversationDto(conv, initiatorId);
    }

    // ----------------------------------------------------------------
    // Sohbetin mesajları (sayfalı, en yeniden eskiye)
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public PageResponse<MessageDto> getMessages(Long conversationId, Long userId, Pageable pageable) {
        Conversation conv = getConversationForUser(conversationId, userId);
        Page<Message> page = messageRepository.findByConversationIdOrderBySentAtDesc(
                conv.getId(), pageable);
        return PageResponse.of(page, m -> toMessageDto(m, userId));
    }

    // ----------------------------------------------------------------
    // Mesaj gönder (+ karşı tarafa bildirim)
    // ----------------------------------------------------------------
    @Transactional
    public MessageDto sendMessage(Long conversationId, Long senderId, MessageRequest req) {
        Conversation conv = getConversationForUser(conversationId, senderId);
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", senderId));

        Message msg = Message.builder()
                .conversation(conv)
                .sender(sender)
                .content(req.getContent().trim())
                .isRead(false)
                .build();
        msg = messageRepository.save(msg);

        // Sıralama için lastMessageAt güncelle
        conv.setLastMessageAt(msg.getSentAt());
        conversationRepository.save(conv);

        // Karşı tarafa bildirim — REQUIRES_NEW propagation ile (notify zaten kendi tx'inde)
        Long recipientId = conv.getCandidate().getId().equals(senderId)
                ? conv.getBusinessOwner().getId()
                : conv.getCandidate().getId();
        String preview = msg.getContent().length() > 80
                ? msg.getContent().substring(0, 80) + "…"
                : msg.getContent();
        notificationService.notify(recipientId,
                NotificationType.NEW_MESSAGE,
                "Yeni mesaj: " + sender.getFullName(),
                preview,
                "messages");

        // FAZ 1/#12 — WebSocket broadcast: konuşmadaki diğer tarafa anında ulaştır
        MessageDto senderView = toMessageDto(msg, senderId);
        broadcastMessage(conv, msg, senderId, recipientId);
        return senderView;
    }

    // ----------------------------------------------------------------
    // Dosya/foto ekli mesaj gönder (chat refactor v2)
    // ----------------------------------------------------------------
    private static final Set<String> IMAGE_EXTS = Set.of("jpg", "jpeg", "png", "webp", "heic", "heif", "gif");
    private static final Set<String> AUDIO_EXTS = Set.of("mp3", "m4a", "ogg", "wav", "webm");

    @Transactional
    public MessageDto sendAttachment(Long conversationId, Long senderId, MultipartFile file, String caption) {
        Conversation conv = getConversationForUser(conversationId, senderId);
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", senderId));

        // Cloudinary'ye yükle, secure_url al
        String url = fileStorageService.storeMessageAttachment(file, conv.getId());

        // Tip belirle (image/file) — frontend render kararı için
        String orig = file.getOriginalFilename() == null ? "dosya" : file.getOriginalFilename();
        String ext = orig.contains(".") ? orig.substring(orig.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : "";
        String type;
        if (IMAGE_EXTS.contains(ext))      type = "image";
        else if (AUDIO_EXTS.contains(ext)) type = "audio";
        else                                type = "file";

        Message msg = Message.builder()
                .conversation(conv)
                .sender(sender)
                .content(caption == null ? "" : caption.trim())
                .attachmentUrl(url)
                .attachmentType(type)
                .attachmentName(orig)
                .attachmentSize(file.getSize())
                .isRead(false)
                .build();
        msg = messageRepository.save(msg);

        conv.setLastMessageAt(msg.getSentAt());
        conversationRepository.save(conv);

        // Karşı tarafa bildirim
        Long recipientId = conv.getCandidate().getId().equals(senderId)
                ? conv.getBusinessOwner().getId()
                : conv.getCandidate().getId();
        String preview;
        if ("image".equals(type))      preview = "📷 Foto gönderdi";
        else if ("audio".equals(type)) preview = "🎙 Sesli mesaj";
        else                            preview = "📎 " + orig;
        notificationService.notify(recipientId,
                NotificationType.NEW_MESSAGE,
                "Yeni mesaj: " + sender.getFullName(),
                preview,
                "messages");

        // FAZ 1/#12 — WebSocket broadcast
        MessageDto senderView = toMessageDto(msg, senderId);
        broadcastMessage(conv, msg, senderId, recipientId);
        return senderView;
    }

    // ----------------------------------------------------------------
    // Sohbet aç + ilk sistem mesajı (başvuru ile birlikte otomatik açılır)
    // Public — ApplicationService'ten çağrılır.
    // ----------------------------------------------------------------
    @Transactional
    public Conversation openConversationForApplication(Application application, String firstSystemMessage) {
        User candidate     = application.getCandidate();
        User businessOwner = application.getJobListing().getBusiness().getOwner();

        Conversation conv = conversationRepository
                .findByCandidateIdAndBusinessOwnerId(candidate.getId(), businessOwner.getId())
                .orElseGet(() -> {
                    Conversation c = Conversation.builder()
                            .candidate(candidate)
                            .businessOwner(businessOwner)
                            .application(application)
                            .build();
                    return conversationRepository.save(c);
                });

        // Sistem mesajı — sender = aday (gerçek user ID lazım, NOT NULL constraint)
        // Frontend "system" flag'ini sentAt + boş senderName'den de algılayabilir
        // ama biz isRead=true vererek "bildirimsiz" kabul ediyoruz.
        if (firstSystemMessage != null && !firstSystemMessage.isBlank()) {
            Message sys = Message.builder()
                    .conversation(conv)
                    .sender(candidate)               // sistem mesajı aday tarafından gönderilmiş sayılır
                    .content(firstSystemMessage.trim())
                    .isRead(false)                    // işletme okunmamış gibi görsün
                    .build();
            sys = messageRepository.save(sys);
            conv.setLastMessageAt(sys.getSentAt());
            conversationRepository.save(conv);

            // İşletmeye bildirim
            notificationService.notify(businessOwner.getId(),
                    NotificationType.NEW_MESSAGE,
                    "Yeni başvuru: " + candidate.getFullName(),
                    firstSystemMessage.length() > 100
                            ? firstSystemMessage.substring(0, 100) + "…"
                            : firstSystemMessage,
                    "messages");
        }

        return conv;
    }

    // ----------------------------------------------------------------
    // Okundu işaretle (sohbete girince)
    // ----------------------------------------------------------------
    @Transactional
    public int markRead(Long conversationId, Long userId) {
        getConversationForUser(conversationId, userId);  // yetki kontrolü
        return messageRepository.markAllReadForUserInConversation(conversationId, userId);
    }

    // ----------------------------------------------------------------
    // Tüm sohbetlerde benim için okunmamış toplam (zil ikonu için)
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public long countUnread(Long userId) {
        return messageRepository.countUnreadForUser(userId);
    }

    // ----------------------------------------------------------------
    // FAZ 1/#12 — WebSocket broadcast helper
    // ----------------------------------------------------------------

    /**
     * Mesajı her iki tarafa anında push. Her taraf kendi viewerId'sine göre
     * 'mine' flag'i farklı görür — bu yüzden 2 ayrı convertAndSendToUser çağırıyoruz.
     *
     * Frontend sub: /user/queue/messages → conversationId payload'ta var,
     * client kendi aktif conversation'a göre filtreler.
     */
    private void broadcastMessage(Conversation conv, Message msg, Long senderId, Long recipientId) {
        try {
            MessageDto forSender    = toMessageDto(msg, senderId);
            MessageDto forRecipient = toMessageDto(msg, recipientId);

            // FIX: convertAndSendToUser → Principal.getName() ile eslestirir.
            // Principal.getName() = EMAIL (id degil).
            User sender    = conv.getCandidate().getId().equals(senderId) ? conv.getCandidate() : conv.getBusinessOwner();
            User recipient = conv.getCandidate().getId().equals(recipientId) ? conv.getCandidate() : conv.getBusinessOwner();

            messagingTemplate.convertAndSendToUser(
                    sender.getEmail(),
                    "/queue/messages",
                    new WsMessagePayload(conv.getId(), forSender)
            );
            messagingTemplate.convertAndSendToUser(
                    recipient.getEmail(),
                    "/queue/messages",
                    new WsMessagePayload(conv.getId(), forRecipient)
            );
        } catch (Exception e) {
            log.warn("WS broadcast failed for conv={}: {}", conv.getId(), e.getMessage());
        }
    }

    /** Frontend için basit wrapper. */
    public record WsMessagePayload(Long conversationId, MessageDto message) {}

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    /** Sohbeti getir + bu kullanıcının sohbetin tarafı olduğunu doğrula. */
    private Conversation getConversationForUser(Long conversationId, Long userId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Sohbet", conversationId));
        if (!conv.getCandidate().getId().equals(userId)
                && !conv.getBusinessOwner().getId().equals(userId)) {
            throw new UnauthorizedException("Bu sohbete erişiminiz yok");
        }
        return conv;
    }

    private ConversationDto toConversationDto(Conversation c, Long viewerId) {
        boolean iAmCandidate = c.getCandidate().getId().equals(viewerId);
        User otherParty = iAmCandidate ? c.getBusinessOwner() : c.getCandidate();

        Message last = messageRepository.findFirstByConversationIdOrderBySentAtDesc(c.getId());
        String preview = last == null
                ? null
                : (last.getContent().length() > 100
                        ? last.getContent().substring(0, 100) + "…"
                        : last.getContent());

        long unread = messageRepository.countUnreadInConversation(c.getId(), viewerId);

        return ConversationDto.builder()
                .id(c.getId())
                .otherPartyId(otherParty.getId())
                .otherPartyName(otherParty.getFullName())
                .otherPartyAvatarUrl(otherParty.getAvatarPath() != null
                        ? fileStorageService.publicUrl(otherParty.getAvatarPath())
                        : null)
                .otherPartyRole(otherParty.getRole().name())
                .applicationId(c.getApplication() != null ? c.getApplication().getId() : null)
                .listingTitle(c.getApplication() != null
                        ? c.getApplication().getJobListing().getTitle()
                        : null)
                .lastMessagePreview(preview)
                .lastMessageAt(c.getLastMessageAt())
                .unreadCount(unread)
                .build();
    }

    private MessageDto toMessageDto(Message m, Long viewerId) {
        boolean mine = m.getSender().getId().equals(viewerId);
        return MessageDto.builder()
                .id(m.getId())
                .senderId(m.getSender().getId())
                .senderName(m.getSender().getFullName())
                .content(m.getContent())
                .sentAt(m.getSentAt())
                .isRead(m.getIsRead())
                .mine(mine)
                .attachmentUrl(m.getAttachmentUrl())
                .attachmentType(m.getAttachmentType())
                .attachmentName(m.getAttachmentName())
                .attachmentSize(m.getAttachmentSize())
                .system(false)   // ileride explicit system message için ayrı flag eklenebilir
                .build();
    }
}
