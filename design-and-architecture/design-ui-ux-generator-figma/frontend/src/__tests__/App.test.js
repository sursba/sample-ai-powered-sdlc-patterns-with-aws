import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// Mock the components to avoid complex dependencies
jest.mock('../components/Header', () => {
  return function MockHeader() {
    return <div data-testid="header">Header Component</div>;
  };
});

jest.mock('../pages/HomePage', () => {
  return function MockHomePage() {
    return <div data-testid="home-page">Home Page</div>;
  };
});

jest.mock('../pages/AboutPage', () => {
  return function MockAboutPage() {
    return <div data-testid="about-page">About Page</div>;
  };
});

describe('App Component', () => {
  const renderApp = (initialEntries = ['/']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>
    );
  };

  test('renders without crashing', () => {
    renderApp();
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  test('renders HomePage on root route', () => {
    renderApp(['/']);
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(screen.queryByTestId('about-page')).not.toBeInTheDocument();
  });

  test('renders AboutPage on /about route', () => {
    renderApp(['/about']);
    expect(screen.getByTestId('about-page')).toBeInTheDocument();
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
  });

  test('applies Material-UI theme', () => {
    renderApp();
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
  });

  test('includes CssBaseline for consistent styling', () => {
    const { container } = renderApp();
    // CssBaseline should normalize styles
    expect(container.firstChild).toHaveStyle('box-sizing: border-box');
  });

  test('header is always present regardless of route', () => {
    renderApp(['/']);
    expect(screen.getByTestId('header')).toBeInTheDocument();
    
    renderApp(['/about']);
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  test('handles unknown routes gracefully', () => {
    renderApp(['/unknown-route']);
    // Should still render header but no page content
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('about-page')).not.toBeInTheDocument();
  });
});
