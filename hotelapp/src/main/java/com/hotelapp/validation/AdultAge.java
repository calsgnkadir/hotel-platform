package com.hotelapp.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Doğum tarihinin geçerli bir yaş aralığında olduğunu kontrol eder.
 * Hesaplama: {@code Period.between(birthDate, LocalDate.now()).getYears()}
 *
 * Null geçerli sayılır (opsiyonel alan). Zorunlu yapmak için @NotNull ile birlikte kullan.
 */
@Documented
@Constraint(validatedBy = AdultAgeValidator.class)
@Target({ ElementType.FIELD, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
public @interface AdultAge {

    String message() default "Yaş {min}-{max} aralığında olmalı";

    int min() default 16;

    int max() default 65;

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
