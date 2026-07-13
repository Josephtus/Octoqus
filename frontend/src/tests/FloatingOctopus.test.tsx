import { render, screen } from '@testing-library/react';
import { FloatingOctopus } from '../components/FloatingOctopus';
import { expect, test } from 'vitest';

test('FloatingOctopus renders with correct alt text', () => {
  render(<FloatingOctopus />);
  const imgElement = screen.getByAltText(/Floating Octopus/i);
  expect(imgElement).toBeDefined();
});

test('FloatingOctopus changes image frames over time', async () => {
  render(<FloatingOctopus />);
  const imgElement = screen.getByAltText(/Floating Octopus/i) as HTMLImageElement;
  
  const initialSrc = imgElement.src;
  
  // Wait for frame change (200ms in component)
  await new Promise((r) => setTimeout(r, 300));
  
  expect(imgElement.src).not.toBe(initialSrc);
});
