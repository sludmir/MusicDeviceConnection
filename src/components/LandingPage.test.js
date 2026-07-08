import { render, screen, fireEvent } from '@testing-library/react';
import LandingPage from './LandingPage';

describe('LandingPage', () => {
  test('renders the headline and sign-in CTA', () => {
    render(<LandingPage onSignIn={() => {}} />);
    expect(screen.getByRole('heading', { name: /build your rig/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /sign in with google/i }).length).toBeGreaterThan(0);
  });

  test('sign-in buttons trigger the callback', () => {
    const onSignIn = jest.fn();
    render(<LandingPage onSignIn={onSignIn} />);
    screen.getAllByRole('button', { name: /sign in with google/i }).forEach((btn) => fireEvent.click(btn));
    expect(onSignIn).toHaveBeenCalledTimes(2);
  });

  test('links to the legal page', () => {
    render(<LandingPage onSignIn={() => {}} />);
    expect(screen.getByRole('link', { name: /affiliate disclosure/i })).toHaveAttribute('href', '/legal');
  });
});
