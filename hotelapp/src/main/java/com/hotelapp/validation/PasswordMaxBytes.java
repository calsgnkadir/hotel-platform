package com.hotelapp.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Validates a password using the UTF-8 byte boundary required by BCrypt. */
@Documented
@Constraint(validatedBy = PasswordMaxBytesValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.ANNOTATION_TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface PasswordMaxBytes {
    String message() default PasswordPolicy.MSG_TOO_LONG;
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
