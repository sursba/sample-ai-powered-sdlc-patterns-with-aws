package com.teltacworldwide.config;

import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Gateway Configuration to replace Netflix Zuul functionality
 * 
 * FIXED: Replaced spring-cloud-starter-netflix-zuul with spring-cloud-starter-gateway
 * Spring Cloud Gateway is the recommended replacement for Zuul in Spring Boot 3.x
 */
@Configuration
public class GatewayConfiguration {

    /**
     * Configure routes for the gateway
     * This replaces the Zuul routing configuration
     */
    @Bean
    public RouteLocator customRouteLocator(RouteLocatorBuilder builder) {
        return builder.routes()
            // Example route configuration - replace with your actual routes
            .route("user-service", r -> r.path("/api/users/**")
                .uri("http://localhost:8081"))
            .route("order-service", r -> r.path("/api/orders/**")
                .uri("http://localhost:8082"))
            .route("product-service", r -> r.path("/api/products/**")
                .uri("http://localhost:8083"))
            // Add circuit breaker and retry filters
            .route("resilient-route", r -> r.path("/api/resilient/**")
                .filters(f -> f.circuitBreaker(config -> config.setName("myCircuitBreaker"))
                    .retry(retryConfig -> retryConfig.setRetries(3)))
                .uri("http://localhost:8084"))
            .build();
    }
}
