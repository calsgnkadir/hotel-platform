package com.hotelapp.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import com.hotelapp.exception.BusinessRuleException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import jakarta.servlet.MultipartConfigElement;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.catalina.startup.Tomcat;

import java.nio.file.Path;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.io.ByteArrayOutputStream;
import java.time.Duration;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.AdditionalMatchers.aryEq;
import static org.mockito.Mockito.*;

/** Ordinary service controls; MockMultipartFile does not exercise the HTTP parser. */
class MultipartFunctionalControlsTest {
    private static final byte[] PNG = pixelPng();

    private static byte[] pixelPng() {
        try {
            var bytes = new ByteArrayOutputStream();
            var image = new java.awt.image.BufferedImage(1, 1, java.awt.image.BufferedImage.TYPE_INT_ARGB);
            if (!javax.imageio.ImageIO.write(image, "png", bytes)) {
                throw new IllegalStateException("PNG writer unavailable");
            }
            return bytes.toByteArray();
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Cannot create test PNG", e);
        }
    }

    @Test void ordinarySmallMultipartParsesOnLoopbackTomcat(@TempDir Path temp) throws Exception {
        Cloudinary cloud = mock(Cloudinary.class);
        Uploader uploader = mock(Uploader.class);
        when(cloud.uploader()).thenReturn(uploader);
        when(uploader.upload(any(byte[].class), anyMap())).thenReturn(Map.of());
        FileStorageService storage = new FileStorageService(cloud);
        Tomcat tomcat = new Tomcat();
        tomcat.setBaseDir(temp.resolve("tomcat").toString());
        tomcat.setPort(0);
        tomcat.getConnector().setProperty("address", "127.0.0.1");
        Path docbase = Files.createDirectory(temp.resolve("web"));
        var context = tomcat.addContext("", docbase.toString());
        var wrapper = Tomcat.addServlet(context, "ordinary-upload", new HttpServlet() {
            @Override protected void doPost(HttpServletRequest req, HttpServletResponse res)
                    throws java.io.IOException, jakarta.servlet.ServletException {
                var part = req.getPart("file");
                String ref;
                try (var stream = part.getInputStream()) {
                    ref = storage.storeAvatar(new MockMultipartFile("file", part.getSubmittedFileName(),
                            part.getContentType(), stream.readAllBytes()), 7L);
                }
                res.setContentType("text/plain");
                res.getWriter().write(ref);
            }
        });
        wrapper.setMultipartConfigElement(new MultipartConfigElement(temp.toString(), 1024, 4096, 0));
        context.addServletMappingDecoded("/ordinary-upload", "ordinary-upload");
        try {
            tomcat.start();
            String boundary = "OrdinaryUploadBoundary";
            var body = new ByteArrayOutputStream();
            body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"pixel.png\"\r\n"
                    + "Content-Type: image/png\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
            body.write(PNG);
            body.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.US_ASCII));
            var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:"
                    + tomcat.getConnector().getLocalPort() + "/ordinary-upload"))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())).build();
            var response = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build()
                    .send(request, HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.body()).startsWith("upload:image:kadrom/avatars/7/");
            verify(uploader).upload(aryEq(PNG), argThat(options ->
                    response.body().equals("upload:image:" + options.get("public_id"))
                    && "image".equals(options.get("resource_type"))));
            verifyNoMoreInteractions(uploader);
        } finally {
            tomcat.stop();
            tomcat.destroy();
        }
    }

    @Test void tinyAvatarPreservesBytesAndReturnsUploadedReference() throws Exception {
        Cloudinary cloud = mock(Cloudinary.class);
        Uploader uploader = mock(Uploader.class);
        when(cloud.uploader()).thenReturn(uploader);
        when(uploader.upload(any(byte[].class), anyMap())).thenReturn(Map.of());
        String ref = new FileStorageService(cloud).storeAvatar(
                new MockMultipartFile("file", "pixel.png", "image/png", PNG), 7L);
        assertThat(ref).startsWith("upload:image:kadrom/avatars/7/");
        verify(uploader).upload(aryEq(PNG), argThat(options ->
                ref.equals("upload:image:" + options.get("public_id"))
                && "image".equals(options.get("resource_type"))
                && "upload".equals(options.get("type"))));
        verifyNoMoreInteractions(uploader);
    }

    @Test void tinyMessageImageRemainsPrivateAndPreservesBytes() throws Exception {
        Cloudinary cloud = mock(Cloudinary.class);
        Uploader uploader = mock(Uploader.class);
        when(cloud.uploader()).thenReturn(uploader);
        when(uploader.upload(any(byte[].class), anyMap())).thenReturn(Map.of());
        String ref = new FileStorageService(cloud).storeMessageAttachment(
                new MockMultipartFile("file", "pixel.png", "image/png", PNG), 9L);
        assertThat(ref).startsWith("authenticated:raw:kadrom/messages/9/").endsWith(".png");
        verify(uploader).upload(aryEq(PNG), argThat(options ->
                ref.equals("authenticated:raw:" + options.get("public_id"))
                && "raw".equals(options.get("resource_type"))
                && "authenticated".equals(options.get("type"))
                && Boolean.FALSE.equals(options.get("overwrite"))));
        verifyNoMoreInteractions(uploader);
    }

    @Test void emptyAvatarIsRejectedBeforeStorage() {
        rejected("pixel.png", new byte[0]);
    }

    @Test void unsupportedAvatarExtensionIsRejectedBeforeStorage() {
        rejected("notes.txt", "ordinary notes".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    @Test void mismatchedAvatarExtensionIsRejectedBeforeStorage() {
        rejected("pixel.jpg", PNG);
    }

    private void rejected(String filename, byte[] bytes) {
        Cloudinary cloud = mock(Cloudinary.class);
        assertThatThrownBy(() -> new FileStorageService(cloud).storeAvatar(
                new MockMultipartFile("file", filename, "image/png", bytes), 7L))
                .isInstanceOf(BusinessRuleException.class);
        verifyNoInteractions(cloud);
    }
}
