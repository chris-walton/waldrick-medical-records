import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../core/api.service';
import {
  DocumentMeta,
  FamilyMember,
  HealthRecord,
  RecordType,
  ScheduleItem,
} from '../../core/models';
import { MemberDialog } from './member-dialog';
import { RecordDialog } from '../records/record-dialog';
import { ScheduleDialog } from '../schedule/schedule-dialog';
import { ConfirmDialog } from '../../shared/confirm-dialog';

@Component({
  selector: 'app-family-detail',
  imports: [
    DatePipe,
    RouterLink,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatCardModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  templateUrl: './family-detail.html',
  styleUrl: './family-detail.scss',
})
export class FamilyDetail {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  readonly id = input<string>('');

  protected member = signal<FamilyMember | null>(null);
  protected records = signal<HealthRecord[]>([]);
  protected schedule = signal<ScheduleItem[]>([]);
  protected documents = signal<DocumentMeta[]>([]);
  protected recordTypes = signal<RecordType[]>([]);
  protected loading = signal(true);

  protected immunizations = computed(() =>
    this.records().filter((r) => r.record_type_key === 'immunization'),
  );

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) this.load(id);
    });
  }

  private load(id: string): void {
    this.loading.set(true);
    forkJoin({
      member: this.api.getFamilyMember(id),
      records: this.api.listRecords({ familyMemberId: id }),
      schedule: this.api.listSchedule({ familyMemberId: id }),
      documents: this.api.listDocuments({ familyMemberId: id }),
      types: this.api.listRecordTypes(),
    }).subscribe({
      next: (res) => {
        this.member.set(res.member);
        this.records.set(res.records);
        this.schedule.set(res.schedule);
        this.documents.set(res.documents);
        this.recordTypes.set(res.types);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private reloadRecords(): void {
    this.api.listRecords({ familyMemberId: this.id() }).subscribe((r) => this.records.set(r));
  }
  private reloadSchedule(): void {
    this.api.listSchedule({ familyMemberId: this.id() }).subscribe((s) => this.schedule.set(s));
  }
  private reloadDocuments(): void {
    this.api.listDocuments({ familyMemberId: this.id() }).subscribe((d) => this.documents.set(d));
  }

  private static readonly MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  /**
   * Format a record's event_date honouring its precision: "Jun 15, 2020" for a full
   * day, "Jun 2020" when only the month is known, "2020" when only the year is.
   * Parses the stored string directly to avoid the timezone drift DatePipe can add.
   */
  protected recordDate(r: HealthRecord): string {
    if (!r.event_date) return '—';
    const [y, m, d] = r.event_date.split('-').map(Number);
    if (r.date_precision === 'year') return `${y}`;
    const month = FamilyDetail.MONTHS[m - 1] ?? '';
    if (r.date_precision === 'month') return `${month} ${y}`;
    return `${month} ${d}, ${y}`;
  }

  protected extras(record: HealthRecord): string {
    if (!record.data_json) return '';
    try {
      const obj = JSON.parse(record.data_json) as Record<string, string>;
      return Object.entries(obj)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ');
    } catch {
      return '';
    }
  }

  protected downloadUrl(id: string): string {
    return this.api.documentDownloadUrl(id);
  }

  protected formatSize(bytes: number | null): string {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // --- member ---
  protected editMember(): void {
    const m = this.member();
    if (!m) return;
    this.dialog
      .open(MemberDialog, { data: { member: m } })
      .afterClosed()
      .subscribe((res) => res && this.member.set(res));
  }

  // --- records ---
  protected addRecord(lockedTypeKey?: string): void {
    this.dialog
      .open(RecordDialog, {
        data: { familyMemberId: this.id(), recordTypes: this.recordTypes(), lockedTypeKey },
      })
      .afterClosed()
      .subscribe((res) => res && this.reloadRecords());
  }

  protected editRecord(r: HealthRecord): void {
    this.dialog
      .open(RecordDialog, { data: { record: r, recordTypes: this.recordTypes() } })
      .afterClosed()
      .subscribe((res) => res && this.reloadRecords());
  }

  protected deleteRecord(r: HealthRecord): void {
    this.confirm(`Delete "${r.title}"?`, 'This record will be permanently removed.').subscribe(
      (ok) => {
        if (ok) this.api.deleteRecord(r.id).subscribe(() => this.reloadRecords());
      },
    );
  }

  // --- schedule ---
  protected addSchedule(): void {
    this.dialog
      .open(ScheduleDialog, {
        data: {
          familyMemberId: this.id(),
          members: this.member() ? [this.member()!] : [],
          recordTypes: this.recordTypes(),
        },
      })
      .afterClosed()
      .subscribe((res) => res && this.reloadSchedule());
  }

  protected editSchedule(s: ScheduleItem): void {
    this.dialog
      .open(ScheduleDialog, {
        data: {
          item: s,
          members: this.member() ? [this.member()!] : [],
          recordTypes: this.recordTypes(),
        },
      })
      .afterClosed()
      .subscribe((res) => res && this.reloadSchedule());
  }

  protected completeSchedule(s: ScheduleItem): void {
    this.api.completeScheduleItem(s.id).subscribe({
      next: () => {
        this.reloadSchedule();
        this.reloadRecords();
      },
    });
  }

  protected deleteSchedule(s: ScheduleItem): void {
    this.confirm(`Delete "${s.title}"?`, 'This scheduled item will be removed.').subscribe((ok) => {
      if (ok) this.api.deleteScheduleItem(s.id).subscribe(() => this.reloadSchedule());
    });
  }

  protected isOverdue(s: ScheduleItem): boolean {
    return (
      s.status === 'pending' && !!s.due_date && s.due_date < new Date().toISOString().slice(0, 10)
    );
  }

  // --- documents ---
  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.api.uploadDocument(file, { familyMemberId: this.id() }).subscribe(() => {
      input.value = '';
      this.reloadDocuments();
    });
  }

  protected deleteDocument(d: DocumentMeta): void {
    this.confirm(
      `Delete "${d.filename}"?`,
      'This file will be permanently removed from storage.',
    ).subscribe((ok) => {
      if (ok) this.api.deleteDocument(d.id).subscribe(() => this.reloadDocuments());
    });
  }

  private confirm(title: string, message: string) {
    return this.dialog
      .open(ConfirmDialog, { data: { title, message, confirmLabel: 'Delete', danger: true } })
      .afterClosed();
  }
}
