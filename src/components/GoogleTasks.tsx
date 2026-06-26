import React, { useState, useEffect } from 'react';
import { CheckCircle, Plus, Trash } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: string;
}

interface GoogleTasksProps {
  accessToken: string;
  language: string;
}

export default function GoogleTasks({ accessToken, language }: GoogleTasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (accessToken) {
      fetchTasks();
    }
  }, [accessToken]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists/@default/tasks', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (data.items) {
        setTasks(data.items.map((t: any) => ({ id: t.id, title: t.title, status: t.status })));
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#121417] p-6 rounded-2xl border border-[#00f2ff]/20 shadow-[0_0_20px_rgba(0,242,255,0.04)] relative">
      <h3 className="text-white font-display font-medium text-sm tracking-wider uppercase flex items-center gap-2 mb-4">
        Google Tasks
      </h3>
      {loading ? (
        <div className="text-xs text-gray-500 font-mono">Loading...</div>
      ) : (
        <ul className="space-y-2">
          {tasks.map(task => (
            <li key={task.id} className="flex items-center gap-2 text-xs text-gray-300 font-mono">
              <CheckCircle className={`w-3 h-3 ${task.status === 'completed' ? 'text-[#00f2ff]' : 'text-gray-600'}`} />
              {task.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
