import { render, screen, fireEvent } from '@testing-library/react';
import SceneVariantSwitcher from './SceneVariantSwitcher';

describe('SceneVariantSwitcher', () => {
  test('renders nothing if setupType has no variants', () => {
    const { container } = render(
      <SceneVariantSwitcher setupType="Unknown" value="x" onChange={()=>{}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('shows current variant label in trigger', () => {
    render(<SceneVariantSwitcher setupType="DJ" value="dj-rooftop" onChange={()=>{}} />);
    expect(screen.getByRole('button')).toHaveTextContent(/Rooftop/i);
  });

  test('opens upward menu and lists variants for setup type', () => {
    render(<SceneVariantSwitcher setupType="DJ" value="dj-club" onChange={()=>{}} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Club Booth')).toBeInTheDocument();
    expect(screen.getByText('Rooftop')).toBeInTheDocument();
  });

  test('selecting an option fires onChange with key', () => {
    const onChange = jest.fn();
    render(<SceneVariantSwitcher setupType="DJ" value="dj-club" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Rooftop'));
    expect(onChange).toHaveBeenCalledWith('dj-rooftop');
  });
});
