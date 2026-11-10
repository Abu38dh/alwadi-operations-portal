'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: 'sm' | 'default'
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        // Base layout
        'flex w-full items-center justify-between gap-2',
        'rounded-xl border border-[#E2EDEC] bg-white px-3 py-2 text-sm',
        'text-[#1C2E2D] shadow-none whitespace-nowrap',
        // States
        'transition-all duration-150 outline-none',
        'hover:border-[#00A89D]/50',
        'focus-visible:border-[#00A89D] focus-visible:ring-2 focus-visible:ring-[#00A89D]/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[placeholder]:text-[#9BB5B4]',
        // Sizes
        'data-[size=default]:h-10 data-[size=sm]:h-8',
        // Inner SVG
        '[&_svg]:pointer-events-none [&_svg]:shrink-0',
        '[&_svg:not([class*=\'size-\'])]:size-4',
        '[&_svg:not([class*=\'text-\'])]:text-[#6B8F8E]',
        '*:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50 shrink-0" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          // Container
          'relative z-50 bg-white text-[#1C2E2D]',
          'min-w-[8rem] max-h-[var(--radix-select-content-available-height)]',
          'rounded-xl border border-[#E2EDEC] shadow-lg shadow-[#00A89D]/8',
          'overflow-x-hidden overflow-y-auto',
          // Animations
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2',
          'data-[side=left]:slide-in-from-right-2',
          'data-[side=right]:slide-in-from-left-2',
          'data-[side=top]:slide-in-from-bottom-2',
          'origin-[var(--radix-select-content-transform-origin)]',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className,
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            'p-1.5',
            position === 'popper' &&
              'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1',
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn(
        'text-[#6B8F8E] px-2 py-1.5 text-xs font-medium',
        className
      )}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        // Base
        'relative flex w-full cursor-default select-none items-center',
        'rounded-lg py-2 pr-8 pl-3 text-sm text-[#1C2E2D]',
        'outline-none transition-colors duration-100',
        // Hover
        'hover:bg-[#FEF3E6] hover:text-[#D97E10]',
        // Focus / keyboard nav
        'focus:bg-[#FEF3E6] focus:text-[#D97E10]',
        // Selected (data-state=checked)
        'data-[state=checked]:bg-[#FEF3E6] data-[state=checked]:text-[#D97E10] data-[state=checked]:font-medium',
        // Disabled
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        // SVG
        '[&_svg]:pointer-events-none [&_svg]:shrink-0',
        '[&_svg:not([class*=\'size-\'])]:size-4',
        className,
      )}
      {...props}
    >
      {/* Checkmark */}
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-3.5 text-[#F7941D]" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('bg-[#E2EDEC] pointer-events-none -mx-1 my-1 h-px', className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn('flex cursor-default items-center justify-center py-1 text-[#6B8F8E]', className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn('flex cursor-default items-center justify-center py-1 text-[#6B8F8E]', className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
