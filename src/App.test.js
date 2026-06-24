import { render, screen } from '@testing-library/react';
import App from './App';

test('renders loading screen', () => {
  render(<App />);
  expect(screen.getByText(/9413 sophia ave/i)).toBeInTheDocument();
});
