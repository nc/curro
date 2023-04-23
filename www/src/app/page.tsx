'use client';
import React, { useCallback } from 'react';
import { useAgent } from './useAgent';
import { useSnapshot } from 'valtio';
import { Check, CheckFat, Dot, Spinner, SpinnerGap } from '@phosphor-icons/react';

const MainStyle: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  height: '100vh',
  paddingTop: '24px',
  alignItems: 'center',
};

const MessageStyle: React.CSSProperties = {
  background: '#2D302F',
  border: '1px solid #2D302F',
  borderRadius: '8px',
  padding: '4px 12px',
  fontSize: 15,
  lineHeight: '28px',
  color: 'rgba(255, 255, 255, 0.9)',
  fontFamily: 'Inter, sans-serif',
};

const OutputStyle: React.CSSProperties = {
  ...MessageStyle,
  background: 'transparent',
};

const AgentProcessingStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const AgentOutputStyle: React.CSSProperties = {
  whiteSpace: 'pre-wrap',
  fontFamily: 'Menlo, monospace',
  color: '#929896',
  fontSize: 12,
  lineHeight: '20px',
};

const AnswerStyle: React.CSSProperties = {
  ...MessageStyle,
  background: 'transparent',
};

const MessageListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  padding: '0px 24px',
  gap: 12,
  flex: 0,
  marginTop: 12,
  width: '100%',
  maxWidth: '652px',
};

const InputStyle: React.CSSProperties = {
  ...MessageStyle,
  backgroundColor: '#2D302F',
  color: 'rgba(255, 255, 255, 0.9)',
  border: 'none',
  marginTop: '12px',
  borderRadius: '8px',
  outline: 'none',
  width: '100%',
};

const CursorStyle: React.CSSProperties = {
  width: '2px',
  height: '1em',
  position: 'relative',
  top: '0.25em',
  background: 'rgba(255,255,255,0.9)',
  display: 'inline-block',
};

const HiddenStyle: React.CSSProperties = {
  display: 'none',
};

const SpacerStyle: React.CSSProperties = {
  flex: 1,
};

const FormStyle: React.CSSProperties = {
  display: 'flex',
  padding: '10px 20px 20px',
  // borderTop: '1px solid #2D302F',
  background: '#151817',
  position: 'sticky',
  bottom: 0,
  marginTop: 20,
  width: '100%',
  maxWidth: '652px',
};

export default function Home() {
  const { store, actions } = useAgent();
  const { tasks } = useSnapshot(store);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const query = e.currentTarget.query.value;
      actions.ask(query);
      e.currentTarget.value = '';
    },
    [actions]
  );

  return (
    <main style={MainStyle}>
      {tasks &&
        Object.keys(tasks).map((id) => {
          return (
            <div key={id} style={MessageListStyle}>
              <div style={MessageStyle}>{tasks[id].question}</div>
              <div style={OutputStyle}>
                <div style={AgentProcessingStyle}>
                  {tasks[id].done ? (
                    <>
                      <Check size={20} color="#929896" weight="regular" />
                      Processed
                    </>
                  ) : (
                    <>
                      <SpinnerGap
                        className="icon-spin"
                        size={20}
                        color="#929896"
                        weight="regular"
                      />
                      Processing...
                    </>
                  )}
                </div>
                <span style={AgentOutputStyle}>{tasks[id].output}</span>
                {tasks[id].done ? null : <div style={CursorStyle} />}
              </div>
              {tasks[id].done && tasks[id].answer ? (
                <div style={AnswerStyle}>{tasks[id].answer}</div>
              ) : null}
            </div>
          );
        })}
      <div style={SpacerStyle} />
      <form onSubmit={handleSubmit} style={FormStyle}>
        <input
          name="query"
          type="text"
          placeholder="Ask anything..."
          style={InputStyle}
          autoComplete="off"
        />
        <button type="submit" style={HiddenStyle}>
          Submit
        </button>
      </form>
    </main>
  );
}
