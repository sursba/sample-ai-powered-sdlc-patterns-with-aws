package com.teltacworldwide;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;

/**
 * FIXED: Gateway Service Application
 * 
 * Modernized Spring Boot Gateway service replacing Netflix Zuul
 * - Uses Spring Cloud Gateway instead of deprecated Zuul
 * - Configured for Java 17 with modern Spring Boot 3.x
 * - Includes proper dependency management and configuration
 */
@SpringBootApplication
public class GatewayServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(GatewayServiceApplication.class, args);
    }

    /**
     * Additional route configuration if needed
     * This can supplement the configuration in GatewayConfiguration class
     */
    @Bean
    public RouteLocator additionalRoutes(RouteLocatorBuilder builder) {
        return builder.routes()
            // Health check route
            .route("health-check", r -> r.path("/health")
                .uri("http://localhost:8080/actuator/health"))
            // Metrics route
            .route("metrics", r -> r.path("/metrics")
                .uri("http://localhost:8080/actuator/prometheus"))
            .build();
    }
}
