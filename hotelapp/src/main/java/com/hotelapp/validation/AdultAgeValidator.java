package com.hotelapp.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.time.LocalDate;
import java.time.Period;

/**
 * {@link AdultAge} için gerçek doğrulama mantığı.
 * Null geçerli sayılır (opsiyonel alan).
 */
public class AdultAgeValidator implements ConstraintValidator<AdultAge, LocalDate> {

    private int min;
    private int max;

    @Override
    public void initialize(AdultAge annotation) {
        this.min = annotation.min();
        this.max = annotation.max();
    }

    @Override
    public boolean isValid(LocalDate birthDate, ConstraintValidatorContext context) {
        if (birthDate == null) return true;

        LocalDate today = LocalDate.now();
        // Gelecek tarihli doğum: geçersiz
        if (birthDate.isAfter(today)) return false;

        int age = Period.between(birthDate, today).getYears();
        return age >= min && age <= max;
    }
}
