jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
}));
jest.mock('../firebaseConfig', () => ({ db: {}, auth: { currentUser: { uid: 'test-uid' } } }));

import { render, screen, fireEvent } from '@testing-library/react';
import GhostSpotEditorPanel from './GhostSpotEditorPanel';

const spot = {
  id: 'middle', type: 'middle', recommendedType: 'Mixer (DJM)',
  x: 0, y: 1.05, z: 0, rotationY: 0, size: { width: 0.3, depth: 0.3 }, revealAfterBasic: false,
};

describe('GhostSpotEditorPanel', () => {
  test('shows X/Y/Z inputs seeded from the spot', () => {
    render(<GhostSpotEditorPanel mode="move" spot={spot} onChange={()=>{}} onSave={()=>{}} onCancel={()=>{}} />);
    expect(screen.getByLabelText('X')).toHaveValue(0);
    expect(screen.getByLabelText('Y')).toHaveValue(1.05);
    expect(screen.getByLabelText('Z')).toHaveValue(0);
  });

  test('editing X fires onChange with the updated draft', () => {
    const onChange = jest.fn();
    render(<GhostSpotEditorPanel mode="move" spot={spot} onChange={onChange} onSave={()=>{}} onCancel={()=>{}} />);
    fireEvent.change(screen.getByLabelText('X'), { target: { value: '1.25' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ x: 1.25 }));
  });

  test('Save fires onSave with the current draft', () => {
    const onSave = jest.fn();
    render(<GhostSpotEditorPanel mode="move" spot={spot} onChange={()=>{}} onSave={onSave} onCancel={()=>{}} />);
    fireEvent.change(screen.getByLabelText('Z'), { target: { value: '-0.5' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ z: -0.5 }));
  });

  test('Cancel fires onCancel', () => {
    const onCancel = jest.fn();
    render(<GhostSpotEditorPanel mode="move" spot={spot} onChange={()=>{}} onSave={()=>{}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('add mode shows a suggested-type select with options', () => {
    render(<GhostSpotEditorPanel mode="add" spot={spot} onChange={()=>{}} onSave={()=>{}} onCancel={()=>{}} />);
    const select = screen.getByLabelText(/suggested type/i);
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'Speaker' } });
    expect(select).toHaveValue('Speaker');
  });

  test('move mode does NOT show the suggested-type select', () => {
    render(<GhostSpotEditorPanel mode="move" spot={spot} onChange={()=>{}} onSave={()=>{}} onCancel={()=>{}} />);
    expect(screen.queryByLabelText(/suggested type/i)).not.toBeInTheDocument();
  });
});
