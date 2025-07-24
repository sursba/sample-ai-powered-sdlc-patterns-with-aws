package com.teltacworldwide.config;

import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.actuate.autoconfigure.metrics.MeterRegistryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * FIXED: Micrometer Configuration to resolve dependency cycle
 * 
 * Original Issue: Circular dependency between MeterRegistry and MeterRegistryCustomizer
 * Resolution: Use proper generic typing and avoid injecting MeterRegistry parameter
 */
@Configuration
public class MicrometerConfiguration {

    /**
     * FIXED: Updated MeterRegistryCustomizer to resolve dependency cycle
     * - Removed MeterRegistry parameter injection
     * - Used proper generic typing MeterRegistryCustomizer<MeterRegistry>
     * - Applied lambda expression for cleaner code
     */
    @Bean
    public MeterRegistryCustomizer<MeterRegistry> meterRegistryCustomizer() {
        return registry -> {
            registry.config().commonTags("application", "gateway");
        };
    }
    
    /**
     * Additional customization for specific metrics
     */
    @Bean
    public MeterRegistryCustomizer<MeterRegistry> prometheusCustomizer() {
        return registry -> {
            registry.config()
                .commonTags("service", "gateway-service")
                .commonTags("version", "1.0.0")
                .commonTags("environment", "development");
        };
    }
}
