import { useState, useEffect, Dispatch, SetStateAction } from 'react';

function getValue<T,>(key: string, initialValue: T | (() => T)): T {
  try {
    const item = window.localStorage.getItem(key);
    if (item) {
      return JSON.parse(item);
    }
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
  }

  return initialValue instanceof Function ? initialValue() : initialValue;
}

// Fix: The types `Dispatch` and `SetStateAction` are now imported directly from 'react' 
// to resolve the "Cannot find namespace 'React'" error in the return type annotation.
export function useLocalStorage<T,>(key: string, initialValue: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => getValue(key, initialValue));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}