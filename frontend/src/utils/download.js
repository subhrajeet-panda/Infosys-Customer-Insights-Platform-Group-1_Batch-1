import analyticsApi from '../api/analyticsAxios';

export async function downloadReport(reportType, format) {
  const response = await analyticsApi.get('/reports/export', {
    params: { type: reportType, format },
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${reportType}.${format}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
