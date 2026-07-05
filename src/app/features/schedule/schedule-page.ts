import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../core/api.service';
import { FamilyMember, RecordType, ScheduleItem } from '../../core/models';
import { ScheduleDialog } from './schedule-dialog';
import { ConfirmDialog } from '../../shared/confirm-dialog';

@Component({
  selector: 'app-schedule-page',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Schedule</h1>
          <p class="page-subtitle">Everything that's due across the family.</p>
        </div>
        <button mat-flat-button color="primary" [disabled]="members().length === 0" (click)="add()">
          <mat-icon>add</mat-icon> Add item
        </button>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (members().length === 0) {
        <div class="empty-state">
          <mat-icon>event</mat-icon>
          <p>Add a <a routerLink="/family">family member</a> first, then schedule items for them.</p>
        </div>
      } @else if (items().length === 0) {
        <div class="empty-state"><mat-icon>event_available</mat-icon><p>Nothing scheduled yet.</p></div>
      } @else {
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Member</th><th>What's due</th><th>Type</th><th>Due</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              @for (s of items(); track s.id) {
                <tr [class.overdue-row]="isOverdue(s)">
                  <td>{{ s.family_member_name }}</td>
                  <td>{{ s.title }}</td>
                  <td>{{ s.record_type_label || '—' }}</td>
                  <td>
                    {{ s.due_date ? (s.due_date | date: 'mediumDate') : '—' }}
                    @if (isOverdue(s)) { <span class="severity-urgent">(overdue)</span> }
                  </td>
                  <td><span class="status-{{ s.status }}">{{ s.status }}</span></td>
                  <td class="row-actions">
                    @if (s.status === 'pending') {
                      <button mat-icon-button matTooltip="Mark done + log record" (click)="complete(s)">
                        <mat-icon>check_circle</mat-icon>
                      </button>
                    }
                    <button mat-icon-button (click)="edit(s)"><mat-icon>edit</mat-icon></button>
                    <button mat-icon-button (click)="remove(s)"><mat-icon>delete</mat-icon></button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .table-wrap {
        background: #fff;
        border-radius: 12px;
        padding: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }
      .data-table th {
        text-align: left;
        font-weight: 500;
        color: #5f6368;
        padding: 8px 12px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      }
      .data-table td {
        padding: 8px 12px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      }
      .overdue-row {
        background: #fff4f3;
      }
      .status-pending { color: #a15c00; text-transform: capitalize; }
      .status-done { color: #146c2e; text-transform: capitalize; }
      .status-skipped { color: #5f6368; text-transform: capitalize; }
    `,
  ],
})
export class SchedulePage {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  protected items = signal<ScheduleItem[]>([]);
  protected members = signal<FamilyMember[]>([]);
  protected recordTypes = signal<RecordType[]>([]);
  protected loading = signal(true);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      schedule: this.api.listSchedule(),
      members: this.api.listFamily(),
      types: this.api.listRecordTypes(),
    }).subscribe({
      next: (res) => {
        this.items.set(res.schedule);
        this.members.set(res.members);
        this.recordTypes.set(res.types);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private reload(): void {
    this.api.listSchedule().subscribe((s) => this.items.set(s));
  }

  protected isOverdue(s: ScheduleItem): boolean {
    return s.status === 'pending' && !!s.due_date && s.due_date < new Date().toISOString().slice(0, 10);
  }

  protected add(): void {
    this.dialog
      .open(ScheduleDialog, { data: { members: this.members(), recordTypes: this.recordTypes() } })
      .afterClosed()
      .subscribe((res) => res && this.reload());
  }

  protected edit(s: ScheduleItem): void {
    this.dialog
      .open(ScheduleDialog, { data: { item: s, members: this.members(), recordTypes: this.recordTypes() } })
      .afterClosed()
      .subscribe((res) => res && this.reload());
  }

  protected complete(s: ScheduleItem): void {
    this.api.completeScheduleItem(s.id).subscribe(() => this.reload());
  }

  protected remove(s: ScheduleItem): void {
    this.dialog
      .open(ConfirmDialog, {
        data: { title: `Delete "${s.title}"?`, message: 'This scheduled item will be removed.', confirmLabel: 'Delete', danger: true },
      })
      .afterClosed()
      .subscribe((ok) => ok && this.api.deleteScheduleItem(s.id).subscribe(() => this.reload()));
  }
}
