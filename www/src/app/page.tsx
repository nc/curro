'use client';
// import Image from 'next/image';
// import { Inter } from 'next/font/google';
import React, { useCallback } from 'react';
import { useAgent } from './useAgent';

export default function Home() {
  useAgent();

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // const query = e.currentTarget.query.value;
  }, []);

  return (
    <main>
      <div>
        <form onSubmit={handleSubmit}>
          <input name="query" type="text" placeholder="Query" />
          <button type="submit">Submit</button>
        </form>
      </div>
    </main>
  );
}
