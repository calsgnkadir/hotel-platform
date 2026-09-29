package com.hotelapp.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class PrivateAttachmentStorageTest {
    @Test void chatUploadsAreAuthenticatedOriginals() throws Exception {
        Cloudinary cloud=mock(Cloudinary.class);
        Uploader uploader=mock(Uploader.class);
        when(cloud.uploader()).thenReturn(uploader);
        when(uploader.upload(any(byte[].class),anyMap())).thenReturn(Map.of());
        String ref=new FileStorageService(cloud).storeMessageAttachment(
                new MockMultipartFile("file","sicil.pdf","application/pdf","%PDF-test".getBytes()),7L);
        assertThat(ref).startsWith("authenticated:raw:kadrom/messages/7/");
        verify(uploader).upload(any(byte[].class),argThat(options ->
                "authenticated".equals(options.get("type")) && "raw".equals(options.get("resource_type"))));
    }
    @Test void legacyPublicUrlsAreNeverFetched() {
        Cloudinary cloud=mock(Cloudinary.class);
        assertThatThrownBy(() -> new FileStorageService(cloud).readPrivateAttachment("https://example.com/file.pdf"))
                .isInstanceOf(com.hotelapp.exception.BusinessRuleException.class);
        verifyNoInteractions(cloud);
    }
}
