export async function fetchTextDisplayPage(page, pageSize) {
    const response = await fetch(`http://localhost:3030/api/populate?page=${page}&page_size=${pageSize}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  }
  