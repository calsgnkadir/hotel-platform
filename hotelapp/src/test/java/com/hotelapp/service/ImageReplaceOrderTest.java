package com.hotelapp.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import com.hotelapp.entity.User;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Fotoğraf değiştirme: eski görsel ancak yeni kayıt başarılı olunca silinir. */
class ImageReplaceOrderTest {

    @AfterEach
    void clearTx() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private static Uploader uploaderOf(Cloudinary cloud) {
        Uploader uploader = mock(Uploader.class);
        when(cloud.uploader()).thenReturn(uploader);
        return uploader;
    }

    @Test
    @DisplayName("deleteAfterCommit: işlem onaylanana kadar silmez, onaydan sonra siler")
    void deleteAfterCommit_waitsForCommit() throws Exception {
        Cloudinary cloud = mock(Cloudinary.class);
        Uploader uploader = uploaderOf(cloud);
        FileStorageService storage = new FileStorageService(cloud);
        TransactionSynchronizationManager.initSynchronization();

        storage.deleteAfterCommit("upload:image:kadrom/avatars/1/old");
        verify(uploader, never()).destroy(anyString(), anyMap());

        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        verify(uploader).destroy(eq("kadrom/avatars/1/old"), anyMap());
    }

    @Test
    @DisplayName("deleteOnRollback: işlem geri alınırsa yeni dosyayı siler, onaylanırsa dokunmaz")
    void deleteOnRollback_onlyOnRollback() throws Exception {
        Cloudinary cloud = mock(Cloudinary.class);
        Uploader uploader = uploaderOf(cloud);
        FileStorageService storage = new FileStorageService(cloud);

        TransactionSynchronizationManager.initSynchronization();
        storage.deleteOnRollback("upload:image:kadrom/avatars/1/new");
        TransactionSynchronizationManager.getSynchronizations()
                .forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_COMMITTED));
        verify(uploader, never()).destroy(anyString(), anyMap());
        TransactionSynchronizationManager.clearSynchronization();

        TransactionSynchronizationManager.initSynchronization();
        storage.deleteOnRollback("upload:image:kadrom/avatars/1/new");
        TransactionSynchronizationManager.getSynchronizations()
                .forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
        verify(uploader).destroy(eq("kadrom/avatars/1/new"), anyMap());
    }

    @Test
    @DisplayName("Avatar: yeni yükleme başarısız olursa eski fotoğraf silinmez ve kayıt değişmez")
    void avatarUploadFails_oldPhotoKept() {
        UserRepository users = mock(UserRepository.class);
        FileStorageService storage = mock(FileStorageService.class);
        User user = new User();
        user.setId(5L);
        user.setAvatarPath("upload:image:kadrom/avatars/5/old");
        when(users.findById(5L)).thenReturn(Optional.of(user));
        when(storage.storeAvatar(any(), eq(5L))).thenThrow(new BusinessRuleException("Avatar yüklenemedi"));
        CandidateProfileService service = new CandidateProfileService(
                users, storage, mock(ApplicationRepository.class), mock(ProfileViewService.class));

        assertThatThrownBy(() -> service.uploadAvatar(5L,
                new MockMultipartFile("file", "a.jpg", "image/jpeg", new byte[]{1})))
                .isInstanceOf(BusinessRuleException.class);

        verify(storage, never()).delete(anyString());
        verify(storage, never()).deleteAfterCommit(anyString());
        assertThat(user.getAvatarPath()).isEqualTo("upload:image:kadrom/avatars/5/old");
    }

    @Test
    @DisplayName("Avatar: önce yeni yüklenir, eski ancak kayıttan sonra silinmek üzere işaretlenir")
    void avatarReplace_uploadsFirstThenSchedulesOldDelete() {
        UserRepository users = mock(UserRepository.class);
        FileStorageService storage = mock(FileStorageService.class);
        User user = new User();
        user.setId(5L);
        user.setAvatarPath("upload:image:kadrom/avatars/5/old");
        when(users.findById(5L)).thenReturn(Optional.of(user));
        user.setRole(com.hotelapp.enums.Role.CANDIDATE);
        when(storage.storeAvatar(any(), eq(5L))).thenReturn("upload:image:kadrom/avatars/5/new");
        CandidateProfileService service = new CandidateProfileService(
                users, storage, mock(ApplicationRepository.class), mock(ProfileViewService.class));

        service.uploadAvatar(5L, new MockMultipartFile("file", "a.jpg", "image/jpeg", new byte[]{1}));

        InOrder order = inOrder(storage, users);
        order.verify(storage).storeAvatar(any(), eq(5L));
        order.verify(users).save(user);
        order.verify(storage).deleteAfterCommit("upload:image:kadrom/avatars/5/old");
        verify(storage, never()).delete(anyString());
        assertThat(user.getAvatarPath()).isEqualTo("upload:image:kadrom/avatars/5/new");
    }
}
