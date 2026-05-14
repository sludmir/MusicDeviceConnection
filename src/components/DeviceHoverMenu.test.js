import { render, screen, fireEvent } from '@testing-library/react';
import DeviceHoverMenu from './DeviceHoverMenu';

describe('DeviceHoverMenu', () => {
  test('renders nothing when device is null', () => {
    const { container } = render(
      <DeviceHoverMenu device={null} screenPosition={{ x: 0, y: 0 }} onRemove={()=>{}} onSwap={()=>{}} onClose={()=>{}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('shows remove and swap buttons when device present', () => {
    render(
      <DeviceHoverMenu
        device={{ uniqueId: 'd1', name: 'CDJ-3000' }}
        screenPosition={{ x: 100, y: 200 }}
        onRemove={() => {}}
        onSwap={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByLabelText(/remove/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/swap/i)).toBeInTheDocument();
  });

  test('clicking remove calls onRemove with device', () => {
    const onRemove = jest.fn();
    const device = { uniqueId: 'd1', name: 'CDJ-3000' };
    render(
      <DeviceHoverMenu device={device} screenPosition={{ x: 0, y: 0 }} onRemove={onRemove} onSwap={()=>{}} onClose={()=>{}} />
    );
    fireEvent.click(screen.getByLabelText(/remove/i));
    expect(onRemove).toHaveBeenCalledWith(device);
  });

  test('clicking swap calls onSwap with device', () => {
    const onSwap = jest.fn();
    const device = { uniqueId: 'd1', name: 'CDJ-3000' };
    render(
      <DeviceHoverMenu device={device} screenPosition={{ x: 0, y: 0 }} onRemove={()=>{}} onSwap={onSwap} onClose={()=>{}} />
    );
    fireEvent.click(screen.getByLabelText(/swap/i));
    expect(onSwap).toHaveBeenCalledWith(device);
  });
});
