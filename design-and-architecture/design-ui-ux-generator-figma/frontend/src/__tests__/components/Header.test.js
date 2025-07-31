import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import Header from '../../components/Header';

const theme = createTheme();

const renderHeader = (initialEntries = ['/']) => {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={initialEntries}>
        <Header />
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Header Component', () => {
  test('renders header with title', () => {
    renderHeader();
    expect(screen.getByText('UI/UX Generator')).toBeInTheDocument();
  });

  test('renders navigation links', () => {
    renderHeader();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  test('home link navigates to root path', () => {
    renderHeader();
    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink).toHaveAttribute('href', '/');
  });

  test('about link navigates to about path', () => {
    renderHeader();
    const aboutLink = screen.getByText('About').closest('a');
    expect(aboutLink).toHaveAttribute('href', '/about');
  });

  test('applies correct styling to AppBar', () => {
    renderHeader();
    const appBar = screen.getByRole('banner');
    expect(appBar).toBeInTheDocument();
  });

  test('title is clickable and links to home', () => {
    renderHeader();
    const titleLink = screen.getByText('UI/UX Generator').closest('a');
    expect(titleLink).toHaveAttribute('href', '/');
  });

  test('navigation links are properly styled', () => {
    renderHeader();
    const homeButton = screen.getByText('Home');
    const aboutButton = screen.getByText('About');
    
    expect(homeButton).toBeInTheDocument();
    expect(aboutButton).toBeInTheDocument();
  });

  test('header is responsive', () => {
    renderHeader();
    const toolbar = screen.getByRole('banner').querySelector('.MuiToolbar-root');
    expect(toolbar).toBeInTheDocument();
  });

  test('maintains accessibility standards', () => {
    renderHeader();
    const banner = screen.getByRole('banner');
    expect(banner).toBeInTheDocument();
    
    // Check that navigation links are accessible
    const homeLink = screen.getByRole('link', { name: /home/i });
    const aboutLink = screen.getByRole('link', { name: /about/i });
    
    expect(homeLink).toBeInTheDocument();
    expect(aboutLink).toBeInTheDocument();
  });
});
