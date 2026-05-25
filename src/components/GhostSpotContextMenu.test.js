import { render, screen, fireEvent } from '@testing-library/react';
import GhostSpotContextMenu from './GhostSpotContextMenu';

describe('GhostSpotContextMenu', () => {
  const baseProps = {
    screenPosition: { x: 100, y: 120 },
    recommendedType: 'Mixer (DJM)',
    onMove: jest.fn(),
    onAdd: jest.fn(),
    onRemove: jest.fn(),
    onClose: jest.fn(),
  };

  test('renders the three actions and the spot label', () => {
    render(<GhostSpotContextMenu {...baseProps} />);
    expect(screen.getByText(/Mixer \(DJM\)/)).toBeInTheDocument();
    // Anchored patterns: unanchored /move/i would also match "Remove".
    expect(screen.getByRole('button', { name: /^move$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^add adjacent$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^remove$/i })).toBeInTheDocument();
  });

  test('fires the matching callbacks', () => {
    const onMove = jest.fn();
    const onAdd = jest.fn();
    const onRemove = jest.fn();
    render(<GhostSpotContextMenu {...baseProps} onMove={onMove} onAdd={onAdd} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /^move$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^add adjacent$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test('renders nothing without a screenPosition', () => {
    const { container } = render(<GhostSpotContextMenu {...baseProps} screenPosition={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
