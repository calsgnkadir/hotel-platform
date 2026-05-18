package com.hotelapp.service;

import com.hotelapp.dto.AuthResponse;
import com.hotelapp.dto.LoginRequest;
import com.hotelapp.dto.RegisterRequest;
import com.hotelapp.entity.Business;
import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final BusinessRepository businessRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessRuleException("Bu email adresi zaten kayıtlı: " + request.getEmail());
        }

        User user = User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .phone(request.getPhone())
                .build();

        userRepository.save(user);

        if (request.getRole() == Role.BUSINESS_OWNER) {
            Business business = Business.builder()
                    .name(request.getBusinessName())
                    .type(request.getBusinessType())
                    .district(request.getDistrict())
                    .address(request.getAddress())
                    .phone(request.getBusinessPhone())
                    .website(request.getWebsite())
                    .description(request.getDescription())
                    .owner(user)
                    .build();
            businessRepository.save(business);
        }

        return AuthResponse.builder()
                .token(jwtService.generateToken(user))
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", request.getEmail()));

        return AuthResponse.builder()
                .token(jwtService.generateToken(user))
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .build();
    }
}
