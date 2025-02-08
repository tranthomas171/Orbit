import { useState, useCallback } from 'react';
import { fetchTextDisplayPage } from './api';

export default function useTextDisplayData(initialPage = 1, pageSize = 5) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(initialPage);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPage = useCallback(async (pageNum) => {
    setLoading(true);
    try {
      const data = await fetchTextDisplayPage(pageNum, pageSize);
      setTotalCount(data.total_count);
      setPage(data.page);
      // Append new items to the existing list.
      setItems(prevItems => {
        // Optionally, you can add extra properties (e.g. positions) here.
        return pageNum === 1 ? data.items : [...prevItems, ...data.items];
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  return { items, page, totalCount, loading, error, fetchPage };
}
