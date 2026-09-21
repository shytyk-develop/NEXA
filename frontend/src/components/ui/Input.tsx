import type { InputHTMLAttributes } from 'react';
import './ui-kit.css';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = '', ...rest }: InputProps) {
    return <input className={`nexa-ui-input ${className}`.trim()} {...rest} />;
}
