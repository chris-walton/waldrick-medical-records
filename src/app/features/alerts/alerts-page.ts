import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../core/api.service';
import { AlertItem, FamilyMember } from '../../core/models';
import { AlertDialog } from './alert-dialog';

@Component({
  selector: 'app-alerts-page',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Alerts</h1>
          <p class="page-subtitle">
            Overdue and upcoming items are generated automatically from the schedule; you can also add your own.
          </p>
        </div>
        <button mat-flat-button color="primary" (click)="add()">
          <mat-icon>add_alert</mat-icon> Add alert
        </button>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (alerts().length === 0) {
        <div class="empty-state">
          <mat-icon>check_circle</mat-icon>
          <p>All clear — no active alerts.</p>
        </div>
      } @else {
        <div class="alert-list">
          @for (a of alerts(); track a.id) {
            <div class="alert-card severity-border-{{ a.severity }}">
              <mat-icon class="severity-{{ a.severity }} lead-icon">{{ icon(a.severity) }}</mat-icon>
              <div class="alert-main">
                <div class="alert-title">{{ a.title }}</div>
                <div class="muted">
                  @if (a.family_member_name) { {{ a.family_member_name }} · }
                  @if (a.message) { {{ a.message }} }
                  @if (a.due_date) { · due {{ a.due_date | date: 'mediumDate' }} }
                </div>
              </div>
              <div class="alert-tags">
                @if (a.source === 'schedule') {
                  <span class="tag">from schedule</span>
                  <button mat-icon-button matTooltip="Mark done + log record" (click)="complete(a)">
                    <mat-icon>check_circle</mat-icon>
                  </button>
                } @else {
                  <button mat-icon-button matTooltip="Dismiss" (click)="dismiss(a)">
                    <mat-icon>notifications_off</mat-icon>
                  </button>
                  <button mat-icon-button matTooltip="Delete" (click)="remove(a)">
                    <mat-icon>delete</mat-icon>
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .alert-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .alert-card {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #fff;
        border-radius: 10px;
        padding: 12px 16px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        border-left: 4px solid #ccc;
      }
      .severity-border-urgent { border-left-color: #b3261e; }
      .severity-border-warning { border-left-color: #a15c00; }
      .severity-border-info { border-left-color: #00639b; }
      .lead-icon {
        flex: 0 0 auto;
      }
      .alert-main {
        flex: 1 1 auto;
      }
      .alert-title {
        font-weight: 500;
      }
      .alert-tags {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .tag {
        font-size: 0.75rem;
        background: #eef1f4;
        color: #5f6368;
        padding: 2px 8px;
        border-radius: 12px;
      }
    `,
  ],
})
export class AlertsPage {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  protected alerts = signal<AlertItem[]>([]);
  protected members = signal<FamilyMember[]>([]);
  protected loading = signal(true);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({ alerts: this.api.listAlerts(), members: this.api.listFamily() }).subscribe({
      next: (res) => {
        this.alerts.set(res.alerts);
        this.members.set(res.members);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private reload(): void {
    this.api.listAlerts().subscribe((a) => this.alerts.set(a));
  }

  protected icon(s: string): string {
    return s === 'urgent' ? 'error' : s === 'warning' ? 'warning' : 'info';
  }

  protected add(): void {
    this.dialog
      .open(AlertDialog, { data: { members: this.members() } })
      .afterClosed()
      .subscribe((res) => res && this.reload());
  }

  protected dismiss(a: AlertItem): void {
    this.api.updateAlert(a.id, { status: 'dismissed' }).subscribe(() => this.reload());
  }

  protected remove(a: AlertItem): void {
    this.api.deleteAlert(a.id).subscribe(() => this.reload());
  }

  protected complete(a: AlertItem): void {
    if (!a.schedule_item_id) return;
    this.api.completeScheduleItem(a.schedule_item_id).subscribe(() => this.reload());
  }
}
