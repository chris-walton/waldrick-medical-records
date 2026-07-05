import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../core/api.service';
import { AlertItem, FamilyMember, ScheduleItem } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [
    DatePipe,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Dashboard</h1>
          <p class="page-subtitle">Alerts and what's coming up across the family.</p>
        </div>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else {
        <div class="dash-grid">
          <mat-card>
            <mat-card-header>
              <mat-card-title><mat-icon>notifications_active</mat-icon> Alerts</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @if (alerts().length === 0) {
                <p class="muted all-clear"><mat-icon>check_circle</mat-icon> All clear — no active alerts.</p>
              } @else {
                @for (a of alerts(); track a.id) {
                  <div class="alert-row">
                    <mat-icon class="severity-{{ a.severity }}">{{ severityIcon(a.severity) }}</mat-icon>
                    <div class="alert-body">
                      <div class="alert-title">{{ a.title }}</div>
                      <div class="muted alert-meta">
                        @if (a.family_member_name) { {{ a.family_member_name }} · }
                        {{ a.message }}
                      </div>
                    </div>
                  </div>
                }
                <a mat-button routerLink="/alerts" class="see-all">See all alerts</a>
              }
            </mat-card-content>
          </mat-card>

          <mat-card>
            <mat-card-header>
              <mat-card-title><mat-icon>event_upcoming</mat-icon> Upcoming &amp; overdue</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @if (upcoming().length === 0) {
                <p class="muted">Nothing scheduled. Add items from a family member's Schedule tab.</p>
              } @else {
                @for (s of upcoming(); track s.id) {
                  <div class="alert-row">
                    <mat-icon [class.severity-urgent]="isOverdue(s)">event</mat-icon>
                    <div class="alert-body">
                      <div class="alert-title">{{ s.title }}</div>
                      <div class="muted alert-meta">
                        {{ s.family_member_name }} · due {{ s.due_date ? (s.due_date | date: 'mediumDate') : '—' }}
                        @if (isOverdue(s)) { <span class="severity-urgent">(overdue)</span> }
                      </div>
                    </div>
                  </div>
                }
                <a mat-button routerLink="/schedule" class="see-all">Open schedule</a>
              }
            </mat-card-content>
          </mat-card>

          <mat-card class="family-card">
            <mat-card-header>
              <mat-card-title><mat-icon>groups</mat-icon> Family</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @if (members().length === 0) {
                <p class="muted">No family members yet.</p>
                <a mat-flat-button color="primary" routerLink="/family">Add family</a>
              } @else {
                <div class="member-chips">
                  @for (m of members(); track m.id) {
                    <a class="member-chip" [routerLink]="['/family', m.id]">
                      <span class="chip-avatar">{{ m.name.charAt(0).toUpperCase() }}</span>
                      {{ m.name }}
                    </a>
                  }
                </div>
              }
            </mat-card-content>
          </mat-card>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .dash-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 16px;
        align-items: start;
      }
      mat-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1.1rem;
      }
      .all-clear {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .alert-row {
        display: flex;
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      }
      .alert-row:last-of-type {
        border-bottom: none;
      }
      .alert-title {
        font-weight: 500;
      }
      .alert-meta {
        font-size: 0.85rem;
      }
      .see-all {
        margin-top: 8px;
      }
      .member-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .member-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px 4px 4px;
        background: #eaf1f8;
        border-radius: 20px;
        text-decoration: none;
        color: #1a1c1e;
        font-size: 0.9rem;
      }
      .chip-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #00639b;
        color: #fff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
      }
    `,
  ],
})
export class Dashboard {
  private api = inject(ApiService);

  protected alerts = signal<AlertItem[]>([]);
  protected members = signal<FamilyMember[]>([]);
  private allSchedule = signal<ScheduleItem[]>([]);
  protected loading = signal(true);

  protected upcoming = computed(() =>
    this.allSchedule()
      .filter((s) => s.status === 'pending' && s.due_date)
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
      .slice(0, 8),
  );

  constructor() {
    forkJoin({
      alerts: this.api.listAlerts(),
      members: this.api.listFamily(),
      schedule: this.api.listSchedule(),
    }).subscribe({
      next: (res) => {
        this.alerts.set(res.alerts.slice(0, 8));
        this.members.set(res.members);
        this.allSchedule.set(res.schedule);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected severityIcon(s: string): string {
    return s === 'urgent' ? 'error' : s === 'warning' ? 'warning' : 'info';
  }

  protected isOverdue(s: ScheduleItem): boolean {
    return !!s.due_date && s.due_date < new Date().toISOString().slice(0, 10);
  }
}
