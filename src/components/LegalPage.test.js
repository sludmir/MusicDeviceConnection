import { render, screen } from '@testing-library/react';
import LegalPage from './LegalPage';

describe('LegalPage', () => {
  test('shows the Amazon Associates disclosure', () => {
    render(<LegalPage />);
    expect(screen.getByText(/as an amazon associate/i)).toBeInTheDocument();
  });

  test('shows privacy policy and contact email', () => {
    render(<LegalPage />);
    expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByText(/sebasludmir@gmail\.com/i)).toBeInTheDocument();
  });
});
