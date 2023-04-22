'use client';
// import Image from 'next/image';
// import { Inter } from 'next/font/google';
import React, { useCallback } from 'react';
import { useAgent } from './useAgent';
import { useSnapshot } from 'valtio';

export default function Home() {
  const { store, actions } = useAgent();
  const { tasks } = useSnapshot(store);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const query = e.currentTarget.query.value;
      actions.ask(query);
    },
    [actions]
  );

  return (
    <main>
      <div>
        <form onSubmit={handleSubmit}>
          <input name="query" type="text" placeholder="Query" />
          <button type="submit">Submit</button>
        </form>
      </div>
      {tasks &&
        Object.keys(tasks).map((id) => {
          return (
            <div key={id}>
              <div>{tasks[id].question}</div>
              <div>{tasks[id].answer}</div>
            </div>
          );
        })}
    </main>
  );
}
