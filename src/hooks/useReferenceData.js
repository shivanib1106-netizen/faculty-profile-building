import React, { useCallback, useEffect, useState } from 'react';
import { systemApi } from '../api/systemApi';

/** Loads academic years once and derives the active year. */
export const useAcademicYears = () => {
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const data = await systemApi.getAcademicYears({ signal });
      setYears(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'Unable to load academic years.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const activeYear = years.find((year) => year.status === 'Active')?.year || '';

  return { years, activeYear, loading, error, reload: load };
};

/** Loads upload constraints supplied by the backend. */
export const useUploadConfig = () => {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    systemApi
      .getUploadConfig()
      .then((data) => {
        if (active) setConfig(data);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Upload constraints could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, []);

  return { config, error };
};

export default useAcademicYears;
