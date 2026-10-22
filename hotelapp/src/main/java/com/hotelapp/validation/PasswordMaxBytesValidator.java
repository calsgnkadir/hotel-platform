package com.hotelapp.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public final class PasswordMaxBytesValidator implements ConstraintValidator<PasswordMaxBytes, String> {
    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        return value == null || PasswordPolicy.isWithinBcryptLimit(value);
    }
}
