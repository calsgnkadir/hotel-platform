package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.User;
import com.iyzipay.Options;
import com.iyzipay.model.*;
import com.iyzipay.request.CreateCheckoutFormInitializeRequest;
import com.iyzipay.request.RetrieveCheckoutFormRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PreDestroy;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * iyzico Checkout Form (hosted ödeme sayfası).
 *
 * Kart bilgisini biz TUTMAYIZ: iyzico'nun barındırdığı forma yönlendiririz,
 * o da callback'e token döner. Canlıya geçiş = env key değişimi (kod aynı).
 *
 * Kodda varsayılan anahtar YOK (IYZICO_API_KEY / IYZICO_SECRET_KEY). Anahtar
 * verilmezse ödeme kapalıdır: iyzico hiç çağrılmaz, abonelik başlatılamaz ve
 * ilan kotası uygulanmaz (BillingService). Eskiden boşken sandbox anahtarlarına
 * düşülüyordu — canlıda iyzico'nun herkese açık test kartıyla bedava abonelik
 * alınabiliyordu. Canlıda sandbox ayarı ProductionSafetyConfiguration'da reddedilir.
 */
@Component
@Slf4j
public class IyzicoClient {

    /**
     * iyzipay-java (2.0.x) HTTP zaman aşımı kütüphanede SABİT 140 sn (connect + read;
     * Options'ta ayar yok). Çağrı sınırlı bir havuzda koşturulur, çağıran en fazla
     * {@code timeoutMs} bekler. Zaman aşımında arka plandaki bağlantı kütüphanenin
     * kendi süresi dolana kadar o havuz thread'ini tutabilir — havuz küçük ve sınırlı
     * (dolarsa yeni çağrı hemen "meşgul" hatası alır, istek thread'leri tükenmez).
     */
    static final int DEFAULT_TIMEOUT_MS = 20_000;
    private static final int MAX_CONCURRENT_CALLS = 4;

    private final Options options;
    private final String callbackUrl;
    private final boolean configured;
    private final boolean sandbox;
    private final long timeoutMs;
    private final ThreadPoolExecutor httpPool;

    public IyzicoClient(String apiKey, String secretKey, String baseUrl, String callbackUrl) {
        this(apiKey, secretKey, baseUrl, callbackUrl, DEFAULT_TIMEOUT_MS);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public IyzicoClient(
            @Value("${app.iyzico.api-key:}") String apiKey,
            @Value("${app.iyzico.secret-key:}") String secretKey,
            @Value("${app.iyzico.base-url:https://sandbox-api.iyzipay.com}") String baseUrl,
            @Value("${app.iyzico.callback-url:http://localhost:8080/api/billing/callback}") String callbackUrl,
            @Value("${app.iyzico.timeout-ms:20000}") long timeoutMs) {
        this.timeoutMs = timeoutMs;
        AtomicInteger seq = new AtomicInteger();
        this.httpPool = new ThreadPoolExecutor(0, MAX_CONCURRENT_CALLS, 60, TimeUnit.SECONDS,
                new SynchronousQueue<>(), r -> {
                    Thread t = new Thread(r, "iyzico-http-" + seq.incrementAndGet());
                    t.setDaemon(true);
                    return t;
                }, new ThreadPoolExecutor.AbortPolicy());
        this.options = new Options();
        this.options.setApiKey(apiKey);
        this.options.setSecretKey(secretKey);
        this.options.setBaseUrl(baseUrl);
        this.callbackUrl = callbackUrl;
        this.configured = !isBlank(apiKey) && !isBlank(secretKey);
        this.sandbox = isSandbox(baseUrl, apiKey);
        if (!configured) {
            log.info("[IYZICO] Anahtar yok — ödeme kapalı (abonelik başlatılamaz, ilan kotası uygulanmaz).");
        } else if (sandbox) {
            log.info("[IYZICO] SANDBOX modunda — gerçek para hareket etmez.");
        }
    }

    /** API anahtarı + gizli anahtar verilmiş mi (ödeme alınabilir mi). */
    public boolean isConfigured() { return configured; }

    /** Test (sandbox) ortamı mı — adres ya da anahtar 'sandbox' içeriyor. */
    public boolean isSandbox() { return sandbox; }

    static boolean isSandbox(String baseUrl, String apiKey) {
        return (baseUrl != null && baseUrl.toLowerCase().contains("sandbox"))
                || (apiKey != null && apiKey.trim().startsWith("sandbox-"));
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }

    public record CheckoutInit(boolean ok, String token, String paymentPageUrl,
                               String checkoutFormContent, String error) {}
    /**
     * retrieve sonucu. paidPrice/basketId/conversationId iyzico'nun döndürdüğü
     * değerlerdir; BillingService bunları kendi kaydıyla karşılaştırır.
     */
    public record CheckoutResult(boolean paid, String paymentId, String paymentStatus, String error,
                                 BigDecimal paidPrice, String basketId, String conversationId) {
        public CheckoutResult(boolean paid, String paymentId, String paymentStatus, String error) {
            this(paid, paymentId, paymentStatus, error, null, null, null);
        }
    }

    /** Abonelik sepet kimliği — checkout başlatırken gönderilir, dönüşte doğrulanır. */
    public static String basketIdFor(Long businessId) {
        return "SUB-" + businessId;
    }

    /** Abonelik ödemesi için hosted checkout başlatır. */
    public CheckoutInit startCheckout(Business business, User owner, BigDecimal price,
                                      String planName, String conversationId) {
        if (!configured) {
            return new CheckoutInit(false, null, null, null, "Ödeme sistemi henüz aktif değil.");
        }
        try {
            CreateCheckoutFormInitializeRequest req = new CreateCheckoutFormInitializeRequest();
            req.setLocale(Locale.TR.getValue());
            req.setConversationId(conversationId);
            req.setPrice(price);
            req.setPaidPrice(price);
            req.setCurrency(Currency.TRY.name());
            req.setBasketId(basketIdFor(business.getId()));
            req.setPaymentGroup(PaymentGroup.SUBSCRIPTION.name());
            req.setCallbackUrl(callbackUrl);
            req.setEnabledInstallments(List.of(1));

            Buyer buyer = new Buyer();
            buyer.setId("BIZ-" + business.getId());
            buyer.setName(safe(owner != null ? owner.getFullName() : business.getName(), "Isletme"));
            buyer.setSurname("Yetkili");
            buyer.setGsmNumber("+905350000000");
            buyer.setEmail(owner != null && owner.getEmail() != null ? owner.getEmail() : "isletme@kadrom.local");
            buyer.setIdentityNumber("11111111111"); // sandbox
            buyer.setRegistrationAddress(safe(business.getDistrict(), "Istanbul"));
            buyer.setCity(safe(business.getDistrict(), "Istanbul"));
            buyer.setCountry("Turkey");
            buyer.setIp("127.0.0.1");
            req.setBuyer(buyer);

            Address addr = new Address();
            addr.setContactName(safe(business.getName(), "Isletme"));
            addr.setCity(safe(business.getDistrict(), "Istanbul"));
            addr.setCountry("Turkey");
            addr.setAddress(safe(business.getAddress(), safe(business.getDistrict(), "Istanbul")));
            req.setBillingAddress(addr);
            req.setShippingAddress(addr);

            BasketItem item = new BasketItem();
            item.setId("PLAN-" + planName);
            item.setName(planName);
            item.setCategory1("Abonelik");
            item.setItemType(BasketItemType.VIRTUAL.name());
            item.setPrice(price);
            req.setBasketItems(List.of(item));

            CheckoutFormInitialize init = callWithTimeout(() -> createBlocking(req));
            if (!"success".equalsIgnoreCase(init.getStatus())) {
                log.warn("[IYZICO] checkout init basarisiz: {} / {}", init.getStatus(), init.getErrorMessage());
                return new CheckoutInit(false, null, null, null, init.getErrorMessage());
            }
            return new CheckoutInit(true, init.getToken(), init.getPaymentPageUrl(),
                    init.getCheckoutFormContent(), null);
        } catch (TimeoutException | java.util.concurrent.RejectedExecutionException e) {
            log.warn("[IYZICO] checkout init yanit vermedi ({}): {}", timeoutMs, e.getClass().getSimpleName());
            return new CheckoutInit(false, null, null, null,
                    "Ödeme sistemi şu an yanıt vermiyor. Lütfen birkaç dakika sonra tekrar deneyin.");
        } catch (Exception e) {
            log.error("[IYZICO] checkout init hata", e);
            return new CheckoutInit(false, null, null, null, e.getMessage());
        }
    }

    /** Callback'te gelen token ile ödeme sonucunu doğrular. */
    public CheckoutResult retrieve(String token) {
        if (!configured) {
            return new CheckoutResult(false, null, null, "Ödeme sistemi aktif değil");
        }
        try {
            RetrieveCheckoutFormRequest req = new RetrieveCheckoutFormRequest();
            req.setToken(token);
            CheckoutForm form = callWithTimeout(() -> retrieveBlocking(req));
            boolean paid = "success".equalsIgnoreCase(form.getStatus())
                    && "SUCCESS".equalsIgnoreCase(form.getPaymentStatus());
            return new CheckoutResult(paid, form.getPaymentId(), form.getPaymentStatus(), form.getErrorMessage(),
                    form.getPaidPrice(), form.getBasketId(), form.getConversationId());
        } catch (TimeoutException e) {
            // paymentStatus null → BillingService oturumu PENDING bırakır, mutabakat tekrar sorar
            log.warn("[IYZICO] retrieve zaman asimi ({} ms) — oturum beklemede kalir", timeoutMs);
            return new CheckoutResult(false, null, null, "iyzico zaman aşımı");
        } catch (Exception e) {
            log.error("[IYZICO] retrieve hata", e);
            return new CheckoutResult(false, null, null, e.getMessage());
        }
    }

    /** Kütüphanenin bloklayan çağrıları — testte zaman aşımını simüle etmek için ayrı. */
    CheckoutFormInitialize createBlocking(CreateCheckoutFormInitializeRequest req) {
        return CheckoutFormInitialize.create(req, options);
    }

    CheckoutForm retrieveBlocking(RetrieveCheckoutFormRequest req) {
        return CheckoutForm.retrieve(req, options);
    }

    /**
     * Çağrıyı sınırlı havuzda koşturur, en fazla timeoutMs bekler.
     * @throws TimeoutException süre dolarsa; RejectedExecutionException havuz doluysa
     */
    <T> T callWithTimeout(Callable<T> call) throws Exception {
        Future<T> f = httpPool.submit(call);
        try {
            return f.get(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            f.cancel(true);
            throw e;
        } catch (ExecutionException e) {
            Throwable c = e.getCause();
            if (c instanceof Exception ex) throw ex;
            throw e;
        }
    }

    @PreDestroy
    void shutdown() {
        httpPool.shutdownNow();
    }

    private static String safe(String v, String fallback) {
        return (v == null || v.isBlank()) ? fallback : v;
    }
}
