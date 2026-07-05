import api from '@/api/client';

export interface UploadedFile {
  id: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
}

async function postUpload(path: string, file: File): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  const { data } = await api.post(path, formData);
  return data.data as UploadedFile;
}

export async function uploadImage(file: File): Promise<UploadedFile> {
  return postUpload('/uploads/image', file);
}

export async function uploadFile(file: File): Promise<UploadedFile> {
  return postUpload('/uploads/file', file);
}

export async function uploadRegisterLogo(file: File): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  const { data } = await api.post('/auth/register/upload', formData);
  return data.data as UploadedFile;
}
