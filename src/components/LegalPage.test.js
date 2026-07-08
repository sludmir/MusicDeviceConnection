import { render, screen } from '@testing-library/react';
import LegalPage from './LegalPage';

describe('LegalPage', () => {
  test('shows the affiliate disclosure', () => {
    render(<LegalPage />);
    expect(screen.getByRole('heading', { name: /affiliate disclosure/i })).toBeInTheDocument();
    expect(screen.getByText(/amazon associates/i)).toBeInTheDocument();
  });

  test('shows privacy policy and contact email', () => {
    render(<LegalPage />);
    expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByText(/sebasludmir@gmail\.com/i)).toBeInTheDocument();
  });

  test('shows content takedown terms', () => {
    render(<LegalPage />);
    expect(screen.getByRole('heading', { name: /your content/i })).toBeInTheDocument();
  });
});
