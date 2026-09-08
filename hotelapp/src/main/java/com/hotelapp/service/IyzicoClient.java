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

import java.math.BigDecimal;
import java.util.List;

/**
 * iyzico Checkout Form (hosted ödeme sayfası) — SANDBOX.
 *
 * Kart bilgisini biz TUTMAYIZ: iyzico'nun barındırdığı forma yönlendiririz,
 * o da callback'e token döner. Canlıya geçiş = env key değişimi (kod aynı).
 * Varsayılan anahtarlar iyzico'nun herkese açık sandbox anahtarlarıdır —
 * gerçek para hareket etmez.
 */
@Component
@Slf4j
public class IyzicoClient {

    private final Options options;
    private final String callbackUrl;

    public IyzicoClient(
            @Value("${app.iyzico.api-key:sandbox-afXhZPW0MQlE4dCUUlHcEopnMBgXnAZI}") String apiKey,
            @Value("${app.iyzico.secret-key:sandbox-wbwpzKIiplZxI3hh5ALI4FJyfFYWnobP}") String secretKey,
            @Value("${app.iyzico.base-url:https://sandbox-api.iyzipay.com}") String baseUrl,
            @Value("${app.iyzico.callback-url:http://localhost:8080/api/billing/callback}") String callbackUrl) {
        this.options = new Options();
        this.options.setApiKey(apiKey);
        this.options.setSecretKey(secretKey);
        this.options.setBaseUrl(baseUrl);
        this.callbackUrl = callbackUrl;
    }

    public record CheckoutInit(boolean ok, String token, String paymentPageUrl,
                               String checkoutFormContent, String error) {}
    public record CheckoutResult(boolean paid, String paymentId, String paymentStatus, String error) {}

    /** Abonelik ödemesi için hosted checkout başlatır. */
    public CheckoutInit startCheckout(Business business, User owner, BigDecimal price,
                                      String planName, String conversationId) {
        try {
            CreateCheckoutFormInitializeRequest req = new CreateCheckoutFormInitializeRequest();
            req.setLocale(Locale.TR.getValue());
            req.setConversationId(conversationId);
            req.setPrice(price);
            req.setPaidPrice(price);
            req.setCurrency(Currency.TRY.name());
            req.setBasketId("SUB-" + business.getId());
            req.setPaymentGroup(PaymentGroup.SUBSCRIPTION.name());
            req.setCallbackUrl(callbackUrl);
            req.setEnabledInstallments(List.of(1));

            Buyer buyer = new Buyer();
            buyer.setId("BIZ-" + business.getId());
            buyer.setName(safe(owner != null ? owner.getFullName() : business.getName(), "Isletme"));
            buyer.setSurname("Yetkili");
            buyer.setGsmNumber("+905350000000");
            buyer.setEmail(owner != null && owner.getEmail() != null ? owner.getEmail() : "isletme@ajanshotel.local");
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

            CheckoutFormInitialize init = CheckoutFormInitialize.create(req, options);
            if (!"success".equalsIgnoreCase(init.getStatus())) {
                log.warn("[IYZICO] checkout init basarisiz: {} / {}", init.getStatus(), init.getErrorMessage());
                return new CheckoutInit(false, null, null, null, init.getErrorMessage());
            }
            return new CheckoutInit(true, init.getToken(), init.getPaymentPageUrl(),
                    init.getCheckoutFormContent(), null);
        } catch (Exception e) {
            log.error("[IYZICO] checkout init hata", e);
            return new CheckoutInit(false, null, null, null, e.getMessage());
        }
    }

    /** Callback'te gelen token ile ödeme sonucunu doğrular. */
    public CheckoutResult retrieve(String token) {
        try {
            RetrieveCheckoutFormRequest req = new RetrieveCheckoutFormRequest();
            req.setToken(token);
            CheckoutForm form = CheckoutForm.retrieve(req, options);
            boolean paid = "success".equalsIgnoreCase(form.getStatus())
                    && "SUCCESS".equalsIgnoreCase(form.getPaymentStatus());
            return new CheckoutResult(paid, form.getPaymentId(), form.getPaymentStatus(), form.getErrorMessage());
        } catch (Exception e) {
            log.error("[IYZICO] retrieve hata", e);
            return new CheckoutResult(false, null, null, e.getMessage());
        }
    }

    private static String safe(String v, String fallback) {
        return (v == null || v.isBlank()) ? fallback : v;
    }
}
