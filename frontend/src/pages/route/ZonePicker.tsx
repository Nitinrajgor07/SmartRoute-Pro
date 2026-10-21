import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { sdaService } from '../../services/api';

export interface ZoneInfo {
  clusterId: number;
  label: string;
  hubIds: number[];
}

interface ZonePickerProps {
  selectedZone: string;
  onSelectZone: (zoneId: string, zoneHubIds: number[] | null) => void;
  disabled?: boolean;
}

export const ZonePicker: React.FC<ZonePickerProps> = ({
  selectedZone,
  onSelectZone,
  disabled = false
}) => {
  const [zones, setZones] = useState<ZoneInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasNoRuns, setHasNoRuns] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchLatestClusterRun() {
      setIsLoading(true);
      try {
        const historyRes = await sdaService.getClusterHistory({ page: 1, per_page: 1 });
        if (!isMounted) return;

        const runs = historyRes?.cluster_runs || [];
        if (runs.length === 0) {
          setHasNoRuns(true);
          return;
        }

        const latestRunId = runs[0].id;
        const detailRes = await sdaService.getClusterDetail(latestRunId);
        if (!isMounted) return;

        const assignments = detailRes?.cluster_run?.assignments || [];
        if (assignments.length === 0) {
          setHasNoRuns(true);
          return;
        }

        // Group assignments by cluster_id
        const map = new Map<number, number[]>();
        for (const a of assignments) {
          const cid = Number(a.cluster_id);
          const lid = Number(a.location_id);
          if (!map.has(cid)) {
            map.set(cid, []);
          }
          map.get(cid)!.push(lid);
        }

        const sortedClusterIds = Array.from(map.keys()).sort((a, b) => a - b);
        const parsedZones: ZoneInfo[] = sortedClusterIds.map((cid) => {
          const hubIds = map.get(cid) || [];
          return {
            clusterId: cid,
            label: `Zone ${cid + 1} (${hubIds.length} hubs)`,
            hubIds
          };
        });

        setZones(parsedZones);
        setHasNoRuns(parsedZones.length === 0);
      } catch {
        if (isMounted) {
          setHasNoRuns(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchLatestClusterRun();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-2 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
        <span>Loading zones...</span>
      </div>
    );
  }

  if (hasNoRuns) {
    return (
      <div className="text-xs text-slate-500 dark:text-slate-400 py-1">
        <span>No zones yet. </span>
        <Link
          to="/delivery-zones"
          className="text-brand-600 dark:text-brand-400 hover:underline font-semibold cursor-pointer"
        >
          Create zones first.
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label
        htmlFor="zone-select"
        className="text-xs font-semibold text-slate-700 dark:text-slate-300 block"
      >
        Zone
      </label>
      <select
        id="zone-select"
        value={selectedZone}
        onChange={(e) => {
          const val = e.target.value;
          if (val === 'all') {
            onSelectZone('all', null);
          } else {
            const cid = Number(val);
            const z = zones.find((item) => item.clusterId === cid);
            onSelectZone(val, z ? z.hubIds : null);
          }
        }}
        disabled={disabled}
        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium cursor-pointer"
      >
        <option value="all">All zones</option>
        {zones.map((zone) => (
          <option key={zone.clusterId} value={zone.clusterId.toString()}>
            {zone.label}
          </option>
        ))}
      </select>
    </div>
  );
};
