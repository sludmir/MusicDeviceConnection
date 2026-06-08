import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CameraAngleControls from './CameraAngleControls';

const emptyAngles = [null, null, null];
const savedAngles = [
  { position: { x: 0, y: 2, z: 3 }, target: { x: 0, y: 0.9, z: 0 } },
  null,
  null,
];

describe('CameraAngleControls', () => {
  test('renders 3 save buttons and 3 recall buttons', () => {
    render(
      <CameraAngleControls cameraAngles={emptyAngles} onSave={() => {}} onRecall={() => {}} />
    );
    expect(screen.getAllByRole('button', { name: /save camera angle/i })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /recall camera angle/i })).toHaveLength(3);
  });

  test('recall buttons are disabled when all slots are empty', () => {
    render(
      <CameraAngleControls cameraAngles={emptyAngles} onSave={() => {}} onRecall={() => {}} />
    );
    screen.getAllByRole('button', { name: /recall camera angle/i }).forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  test('recall button for saved slot is enabled; others remain disabled', () => {
    render(
      <CameraAngleControls cameraAngles={savedAngles} onSave={() => {}} onRecall={() => {}} />
    );
    const recallBtns = screen.getAllByRole('button', { name: /recall camera angle/i });
    expect(recallBtns[0]).not.toBeDisabled();
    expect(recallBtns[1]).toBeDisabled();
    expect(recallBtns[2]).toBeDisabled();
  });

  test('save icon has --saved modifier class only on occupied slots', () => {
    const { container } = render(
      <CameraAngleControls cameraAngles={savedAngles} onSave={() => {}} onRecall={() => {}} />
    );
    const saveBtns = container.querySelectorAll('.camera-angle-save');
    expect(saveBtns[0]).toHaveClass('camera-angle-save--saved');
    expect(saveBtns[1]).not.toHaveClass('camera-angle-save--saved');
    expect(saveBtns[2]).not.toHaveClass('camera-angle-save--saved');
  });

  test('calls onSave with the correct slot index', () => {
    const onSave = jest.fn();
    render(
      <CameraAngleControls cameraAngles={emptyAngles} onSave={onSave} onRecall={() => {}} />
    );
    fireEvent.click(screen.getAllByRole('button', { name: /save camera angle/i })[1]);
    expect(onSave).toHaveBeenCalledWith(1);
  });

  test('calls onRecall with correct slot index when slot is saved', () => {
    const onRecall = jest.fn();
    render(
      <CameraAngleControls cameraAngles={savedAngles} onSave={() => {}} onRecall={onRecall} />
    );
    fireEvent.click(screen.getAllByRole('button', { name: /recall camera angle/i })[0]);
    expect(onRecall).toHaveBeenCalledWith(0);
  });
});
