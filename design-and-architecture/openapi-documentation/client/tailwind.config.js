/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4695eb', // Quarkus blue
        secondary: '#4cb140', // Success green
        primaryDark: '#3d7cc9',
        secondaryDark: '#419a37',
        // Security colors
        security: {
          primary: '#2563eb', // Blue for security elements
          secondary: '#1e40af', // Darker blue for security headers
          success: '#10b981', // Green for successful security checks
          warning: '#f59e0b', // Amber for warnings
          danger: '#ef4444', // Red for security issues
          light: '#dbeafe', // Light blue background
        },
        // Policy colors
        policy: {
          primary: '#8b5cf6', // Purple for policy elements
          secondary: '#6d28d9', // Darker purple for policy headers
          light: '#ede9fe', // Light purple background
          highlight: '#a78bfa', // Highlight for important policy items
        },
        // Rate limiting colors
        rateLimit: {
          low: '#34d399', // Green for low rate limits
          medium: '#fbbf24', // Yellow for medium rate limits
          high: '#f87171', // Red for high rate limits
          bg: '#f0fdf4', // Light green background
        },
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        'card': '0.5rem',
      },
    },
  },
  plugins: [],
}