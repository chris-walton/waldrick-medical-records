import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AlertItem,
  DocumentMeta,
  FamilyMember,
  HealthRecord,
  Identity,
  RecordType,
  ScheduleItem,
} from './models';

const BASE = '/api';

function params(obj: Record<string, string | undefined | null>): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') {
      p = p.set(k, v);
    }
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // --- identity ---
  me(): Observable<Identity> {
    return this.http.get<Identity>(`${BASE}/me`);
  }

  // --- family members ---
  listFamily(): Observable<FamilyMember[]> {
    return this.http.get<FamilyMember[]>(`${BASE}/family`);
  }
  getFamilyMember(id: string): Observable<FamilyMember> {
    return this.http.get<FamilyMember>(`${BASE}/family/${id}`);
  }
  createFamilyMember(body: Partial<FamilyMember>): Observable<FamilyMember> {
    return this.http.post<FamilyMember>(`${BASE}/family`, body);
  }
  updateFamilyMember(id: string, body: Partial<FamilyMember>): Observable<FamilyMember> {
    return this.http.patch<FamilyMember>(`${BASE}/family/${id}`, body);
  }
  deleteFamilyMember(id: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${BASE}/family/${id}`);
  }

  // --- record types ---
  listRecordTypes(): Observable<RecordType[]> {
    return this.http.get<RecordType[]>(`${BASE}/record-types`);
  }
  createRecordType(body: Partial<RecordType>): Observable<RecordType> {
    return this.http.post<RecordType>(`${BASE}/record-types`, body);
  }

  // --- health records ---
  listRecords(opts: { familyMemberId?: string; typeKey?: string } = {}): Observable<HealthRecord[]> {
    return this.http.get<HealthRecord[]>(`${BASE}/records`, {
      params: params({ familyMemberId: opts.familyMemberId, typeKey: opts.typeKey }),
    });
  }
  createRecord(body: Partial<HealthRecord>): Observable<HealthRecord> {
    return this.http.post<HealthRecord>(`${BASE}/records`, body);
  }
  updateRecord(id: string, body: Partial<HealthRecord>): Observable<HealthRecord> {
    return this.http.patch<HealthRecord>(`${BASE}/records/${id}`, body);
  }
  deleteRecord(id: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${BASE}/records/${id}`);
  }

  // --- schedule ---
  listSchedule(opts: { familyMemberId?: string } = {}): Observable<ScheduleItem[]> {
    return this.http.get<ScheduleItem[]>(`${BASE}/schedule`, {
      params: params({ familyMemberId: opts.familyMemberId }),
    });
  }
  createScheduleItem(body: Partial<ScheduleItem>): Observable<ScheduleItem> {
    return this.http.post<ScheduleItem>(`${BASE}/schedule`, body);
  }
  updateScheduleItem(id: string, body: Partial<ScheduleItem>): Observable<ScheduleItem> {
    return this.http.patch<ScheduleItem>(`${BASE}/schedule/${id}`, body);
  }
  completeScheduleItem(
    id: string,
    body: { event_date?: string; location?: string; provider?: string } = {},
  ): Observable<{ ok: true; record: HealthRecord }> {
    return this.http.post<{ ok: true; record: HealthRecord }>(
      `${BASE}/schedule/${id}/complete`,
      body,
    );
  }
  deleteScheduleItem(id: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${BASE}/schedule/${id}`);
  }

  // --- documents ---
  listDocuments(opts: { familyMemberId?: string; recordId?: string } = {}): Observable<DocumentMeta[]> {
    return this.http.get<DocumentMeta[]>(`${BASE}/documents`, {
      params: params({ familyMemberId: opts.familyMemberId, recordId: opts.recordId }),
    });
  }
  uploadDocument(file: File, opts: { familyMemberId?: string; recordId?: string }): Observable<DocumentMeta> {
    const form = new FormData();
    form.append('file', file);
    if (opts.familyMemberId) form.append('familyMemberId', opts.familyMemberId);
    if (opts.recordId) form.append('recordId', opts.recordId);
    return this.http.post<DocumentMeta>(`${BASE}/documents`, form);
  }
  documentDownloadUrl(id: string): string {
    return `${BASE}/documents/${id}`;
  }
  deleteDocument(id: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${BASE}/documents/${id}`);
  }

  // --- alerts (manual rows + schedule-derived) ---
  listAlerts(): Observable<AlertItem[]> {
    return this.http.get<AlertItem[]>(`${BASE}/alerts`);
  }
  createAlert(body: Partial<AlertItem>): Observable<AlertItem> {
    return this.http.post<AlertItem>(`${BASE}/alerts`, body);
  }
  updateAlert(id: string, body: Partial<AlertItem>): Observable<AlertItem> {
    return this.http.patch<AlertItem>(`${BASE}/alerts/${id}`, body);
  }
  deleteAlert(id: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${BASE}/alerts/${id}`);
  }
}
