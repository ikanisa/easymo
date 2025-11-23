import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../tests/utils';
import { Dropdown, DropdownItem, DropdownDivider } from './Dropdown';
import userEvent from '@testing-library/user-event';

describe('Dropdown', () => {
  it('renders trigger button', () => {
    renderWithProviders(
      <Dropdown trigger={<button>Open Menu</button>}>
        <DropdownItem>Item 1</DropdownItem>
      </Dropdown>
    );
    expect(screen.getByText('Open Menu')).toBeInTheDocument();
  });

  it('shows menu when trigger is clicked', async () => {
    renderWithProviders(
      <Dropdown trigger={<button>Open Menu</button>}>
        <DropdownItem>Item 1</DropdownItem>
      </Dropdown>
    );

    const trigger = screen.getByText('Open Menu');
    await userEvent.click(trigger);

    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('renders multiple items', async () => {
    renderWithProviders(
      <Dropdown trigger={<button>Menu</button>}>
        <DropdownItem>Item 1</DropdownItem>
        <DropdownItem>Item 2</DropdownItem>
        <DropdownItem>Item 3</DropdownItem>
      </Dropdown>
    );

    await userEvent.click(screen.getByText('Menu'));

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('calls onClick when item is clicked', async () => {
    const handleClick = vi.fn();

    renderWithProviders(
      <Dropdown trigger={<button>Menu</button>}>
        <DropdownItem onClick={handleClick}>Click me</DropdownItem>
      </Dropdown>
    );

    await userEvent.click(screen.getByText('Menu'));
    await userEvent.click(screen.getByText('Click me'));

    expect(handleClick).toHaveBeenCalled();
  });
});
