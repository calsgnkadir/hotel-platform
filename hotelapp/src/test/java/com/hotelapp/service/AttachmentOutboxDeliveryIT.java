package com.hotelapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.entity.OutboxEvent;
import com.hotelapp.event.EmailMessage;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.OutboxEventRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestTemplate;

import java.time.*;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

/** Real committed outbox rows and Spring transactions; only the provider transport/UI notices are simulated. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:attachment_delivery;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "app.email.resend.api-key=re_local_attachment_test",
        "app.email.resend.base-url=https://attachment-provider.example.test"
})
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AttachmentOutboxDeliveryIT {
    @Autowired OutboxService outbox;
    @Autowired OutboxRelay relay;
    @Autowired OutboxStatusWriter writer;
    @Autowired OutboxAdminService admin;
    @Autowired OutboxEventRepository rows;
    @Autowired EmailService email;
    @Autowired ObjectMapper json;
    @Autowired PlatformTransactionManager transactionManager;
    @MockitoBean NotificationService notifications;
    private MockRestServiceServer provider;
    private final Clock original = Clock.system(ZoneId.of("Europe/Istanbul"));
    private LocalDateTime now;

    @BeforeEach void setup() {
        rows.deleteAll();
        now = LocalDateTime.of(2031, 1, 7, 12, 0);
        at(now);
        provider = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(email, "restTemplate")).build();
    }

    @AfterEach void restore() {
        for (Object bean : new Object[]{outbox, relay, writer}) ReflectionTestUtils.setField(bean, "clock", original);
        provider.verify();
    }

    @Test void attachmentSurvivesFailureAndRetryThenIsRedactedAfterProviderAcceptance() throws Exception {
        byte[] attachment = new byte[70_000];
        Arrays.fill(attachment, (byte) 42);
        email.queueWithAttachment("recipient.person@example.test", "Ekip listesi", "<p>private roster</p>", "roster.xlsx", attachment, 42L);
        OutboxEvent queued = rows.findAll().get(0);
        long id = queued.getId();
        assertThat(queued.getPayload().length()).isGreaterThan(65_535);
        assertThat(queued.getProcessedAt()).isNull();
        attachment[0] = 99;
        EmailMessage snapshot = json.readValue(queued.getPayload(), EmailMessage.class);
        assertThat(snapshot.attachment().content()[0]).isEqualTo((byte) 42);
        assertThat(admin.list("pending", 10).get(0).getPayloadPreview())
                .contains("r***@e***.test").doesNotContain("private roster", "attachment", "content", "recipient.person");
        provider.expect(requestTo("https://attachment-provider.example.test/emails"))
                .andExpect(method(HttpMethod.POST)).andExpect(content().string(containsString("\"attachments\"")))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"message\":\"recipient.person@example.test unavailable\"}"));
        relay.relay();
        OutboxEvent failed = rows.findById(id).orElseThrow();
        assertThat(failed.getAttempts()).isEqualTo(1);
        assertThat(failed.getProcessedAt()).isNull();
        assertThat(failed.getNextAttemptAt()).isEqualTo(now.plusSeconds(30));
        assertThat(failed.getLastError()).contains("503").doesNotContain("recipient.person@example.test");
        assertThat(json.readValue(failed.getPayload(), EmailMessage.class).attachment().content()).hasSize(70_000);
        verifyNoInteractions(notifications);
        provider.verify();
        provider.reset();
        provider.expect(requestTo("https://attachment-provider.example.test/emails"))
                .andRespond(withStatus(HttpStatus.ACCEPTED).body("{\"id\":\"test-provider-id\"}"));
        at(now.plusSeconds(31));
        relay.relay();
        OutboxEvent accepted = rows.findById(id).orElseThrow();
        assertThat(accepted.getProcessedAt()).isNotNull();
        assertThat(accepted.getPayload()).doesNotContain("private roster", "recipient.person", "Kioq");
        assertThat(json.readValue(accepted.getPayload(), EmailMessage.class).attachment()).isNull();
        assertThat(admin.list("all", 10).get(0).getStatus()).isEqualTo("DELIVERED");
        verify(notifications).notify(eq(42L), any(), eq("Ekip listesi sağlayıcıya iletildi"),
                contains("gelen kutusuna teslim onayı değildir"), eq("mylistings"));
        relay.relay(); // A processed row does not send again.
    }

    @Test void exhaustedAttachmentIsVisibleToAdminAndCanBeManuallyRetried() throws Exception {
        email.queueWithAttachment("owner@example.test", "Roster", "private", "roster.xlsx", new byte[]{1, 2}, 42L);
        OutboxEvent row = rows.findAll().get(0);
        row.setAttempts(OutboxRelay.MAX_ATTEMPTS - 1);
        rows.save(row);
        provider.expect(anything()).andRespond(withStatus(HttpStatus.BAD_GATEWAY));
        relay.relay();
        OutboxEvent dead = rows.findById(row.getId()).orElseThrow();
        assertThat(dead.getProcessedAt()).isNull();
        assertThat(dead.getAttempts()).isEqualTo(OutboxRelay.MAX_ATTEMPTS);
        assertThat(admin.list("dead", 10)).hasSize(1);
        verify(notifications).notify(eq(42L), any(), eq("Ekip listesi gönderilemedi"), contains("tekrar denemelere rağmen"), eq("mylistings"));
        admin.retry(row.getId());
        provider.verify();
        provider.reset();
        provider.expect(anything()).andRespond(withStatus(HttpStatus.ACCEPTED));
        relay.relay();
        assertThat(rows.findById(row.getId()).orElseThrow().getProcessedAt()).isNotNull();
        assertThatThrownBy(() -> admin.retry(row.getId())).isInstanceOf(BusinessRuleException.class);
    }

    @Test void rollbackDoesNotLeaveAnAttachmentToSend() {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            email.queueWithAttachment("owner@example.test", "Roster", "private", "roster.xlsx", new byte[]{1}, 42L);
            assertThat(rows.count()).isEqualTo(1);
            status.setRollbackOnly();
        });
        assertThat(rows.count()).isZero();
        relay.relay();
        verifyNoInteractions(notifications);
    }

    @Test void oversizedAttachmentAndPayloadAreRejectedBeforePersisting() {
        assertThatThrownBy(() -> email.queueWithAttachment("owner@example.test", "Roster", "private", "roster.xlsx",
                new byte[EmailMessage.Attachment.MAX_BYTES + 1], 42L)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> outbox.appendEmail(new EmailMessage("owner@example.test", "Roster", "x".repeat(4 * 1024 * 1024))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(rows.count()).isZero();
    }

    @Test void legacyEmailPayloadStillDeliversWithoutAnAttachment() {
        OutboxEvent legacy = rows.save(OutboxEvent.builder().eventType(OutboxService.TYPE_EMAIL)
                .payload("{\"to\":\"legacy@example.test\",\"subject\":\"Legacy\",\"html\":\"private legacy\"}")
                .createdAt(now).attempts(0).build());
        provider.expect(requestTo("https://attachment-provider.example.test/emails"))
                .andExpect(jsonPath("$.to[0]").value("legacy@example.test"))
                .andExpect(jsonPath("$.attachments").doesNotExist())
                .andRespond(withStatus(HttpStatus.ACCEPTED));
        relay.relay();
        assertThat(rows.findById(legacy.getId()).orElseThrow().getProcessedAt()).isNotNull();
        verifyNoInteractions(notifications);
    }

    @Test void failedUiNoticeCannotTriggerDuplicateAttachmentDelivery() {
        email.queueWithAttachment("owner@example.test", "Roster", "private", "roster.xlsx", new byte[]{1}, 42L);
        long id = rows.findAll().get(0).getId();
        doThrow(new IllegalStateException("Notification unavailable")).when(notifications)
                .notify(eq(42L), any(), anyString(), anyString(), anyString());
        provider.expect(anything()).andRespond(withStatus(HttpStatus.ACCEPTED));
        relay.relay();
        assertThat(rows.findById(id).orElseThrow().getProcessedAt()).isNotNull();
        assertThat(rows.findById(id).orElseThrow().getAttempts()).isZero();
        relay.relay();
    }

    private void at(LocalDateTime time) {
        Clock fixed = Clock.fixed(time.atZone(original.getZone()).toInstant(), original.getZone());
        for (Object bean : new Object[]{outbox, relay, writer}) ReflectionTestUtils.setField(bean, "clock", fixed);
    }
}
