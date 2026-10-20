import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Play, Pause, SkipBack, SkipForward, Activity } from 'lucide-react';
import type { DijkstraTraceStep, GraphNode } from '../../types';

interface SearchStepsProps {
  trace: DijkstraTraceStep[] | null | undefined;
  nodes: GraphNode[];
}

export const SearchSteps: React.FC<SearchStepsProps> = ({ trace, nodes }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const nodeMap = React.useMemo(() => {
    const map = new Map<number, GraphNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  const totalSteps = trace?.length ?? 0;
  const currentStep = trace && totalSteps > 0 ? trace[currentStepIndex] : null;

  // Auto-play timer
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && totalSteps > 0) {
      interval = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= totalSteps - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 800);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, totalSteps]);

  // Reset step index when trace changes
  useEffect(() => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
  }, [trace]);

  if (!trace || totalSteps === 0) return null;

  const handlePrev = () => {
    setIsPlaying(false);
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setIsPlaying(false);
    setCurrentStepIndex((prev) => Math.min(totalSteps - 1, prev + 1));
  };

  const handleTogglePlay = () => {
    if (currentStepIndex >= totalSteps - 1) {
      setCurrentStepIndex(0);
    }
    setIsPlaying((prev) => !prev);
  };

  // Build sentence for the current step
  const currentNode = currentStep?.current_node != null ? nodeMap.get(currentStep.current_node) : null;
  const currentDist = currentStep?.current_node != null && currentStep.distances
    ? currentStep.distances[currentStep.current_node]
    : null;

  const stepSentence = currentNode
    ? `${currentNode.name}: ${currentDist != null ? `${currentDist} km` : '0 km'}`
    : `Step ${currentStepIndex + 1}`;

  // Hubs waiting to be checked (snapshot list)
  const waitingHubs = (currentStep?.pq_snapshot || []).slice(0, 6);

  // Shortest distance found so far (distances record with valid numeric distance)
  const recordedDistances = Object.entries(currentStep?.distances || {})
    .filter(([_, dist]) => dist !== null)
    .map(([nodeIdStr, dist]) => ({
      nodeId: Number(nodeIdStr),
      nodeName: nodeMap.get(Number(nodeIdStr))?.name || `Hub #${nodeIdStr}`,
      distance: dist as number
    }))
    .slice(0, 6);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between p-4 bg-slate-50/70 dark:bg-slate-850 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Step-by-step search
          </h3>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
            {totalSteps} steps
          </span>
        </div>
        <div className="text-slate-400">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-5 space-y-4 border-t border-slate-100 dark:border-slate-800">
          {/* Controls Bar & Step Sentence */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentStepIndex === 0}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
              >
                <SkipBack className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={handleTogglePlay}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={currentStepIndex >= totalSteps - 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>

              <span className="text-xs text-slate-500 font-mono ml-2">
                Step {currentStepIndex + 1} / {totalSteps}
              </span>
            </div>

            {/* Current Step Sentence */}
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 truncate">
              {stepSentence}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-200 rounded-full"
              style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
            />
          </div>

          {/* 2 Neutral Metric Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Table 1: Queue */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Search queue
              </h4>
              {waitingHubs.length === 0 ? (
                <div className="text-xs text-slate-400 py-3 text-center">Empty queue</div>
              ) : (
                <div className="space-y-1 text-xs">
                  {waitingHubs.map(([dist, id], idx) => {
                    const nodeName = nodeMap.get(id)?.name || `Hub #${id}`;
                    return (
                      <div
                        key={`waiting-${id}-${idx}`}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-slate-850"
                      >
                        <span className="truncate pr-2 font-medium text-slate-700 dark:text-slate-300">
                          {nodeName}
                        </span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                          {dist} km
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Table 2: Recorded distances */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Recorded distances
              </h4>
              {recordedDistances.length === 0 ? (
                <div className="text-xs text-slate-400 py-3 text-center">No distances</div>
              ) : (
                <div className="space-y-1 text-xs">
                  {recordedDistances.map((item) => (
                    <div
                      key={`dist-${item.nodeId}`}
                      className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-slate-850"
                    >
                      <span className="truncate pr-2 font-medium text-slate-700 dark:text-slate-300">
                        {item.nodeName}
                      </span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                        {item.distance} km
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
