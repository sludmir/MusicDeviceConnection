import { render, screen, fireEvent } from '@testing-library/react';
import ProductSelectorModal from './ProductSelectorModal';

const products = [
  { id: 'm1', name: 'DJM-900', type: 'mixer', subcategory: 'mixers' },
  { id: 'p1', name: 'CDJ-3000', type: 'player', subcategory: 'players' },
  { id: 'f1', name: 'RMX-1000', type: 'effects', subcategory: 'effects' },
];

describe('ProductSelectorModal', () => {
  test('hard-filters to recommended type by default', () => {
    render(
      <ProductSelectorModal
        isOpen
        mode="place"
        recommendedType="Mixer (DJM)"
        products={products}
        onSelect={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('DJM-900')).toBeInTheDocument();
    expect(screen.queryByText('CDJ-3000')).not.toBeInTheDocument();
  });

  test('"Show all products" toggle reveals filtered-out items', () => {
    render(
      <ProductSelectorModal
        isOpen
        mode="place"
        recommendedType="Mixer (DJM)"
        products={products}
        onSelect={() => {}}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByLabelText(/show all products/i));
    expect(screen.getByText('CDJ-3000')).toBeInTheDocument();
  });

  test('"Any Device" shows all products without filtering', () => {
    render(
      <ProductSelectorModal
        isOpen
        mode="place"
        recommendedType="Any Device"
        products={products}
        onSelect={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('DJM-900')).toBeInTheDocument();
    expect(screen.getByText('CDJ-3000')).toBeInTheDocument();
  });

  test('swap mode shows "Current" badge on currentProductId', () => {
    render(
      <ProductSelectorModal
        isOpen
        mode="swap"
        recommendedType="Mixer (DJM)"
        currentProductId="m1"
        products={products}
        onSelect={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  test('onSelect fires with product id when card clicked', () => {
    const onSelect = jest.fn();
    render(
      <ProductSelectorModal
        isOpen
        mode="place"
        recommendedType="Mixer (DJM)"
        products={products}
        onSelect={onSelect}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByText('DJM-900'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
  });
});
