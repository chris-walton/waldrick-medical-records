import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../core/api.service';
import { FamilyMember } from '../../core/models';
import { MemberDialog } from './member-dialog';
import { ConfirmDialog } from '../../shared/confirm-dialog';

@Component({
  selector: 'app-family-list',
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Family</h1>
          <p class="page-subtitle">Everyone whose records you're tracking.</p>
        </div>
        <button mat-flat-button color="primary" (click)="add()">
          <mat-icon>person_add</mat-icon> Add member
        </button>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (members().length === 0) {
        <div class="empty-state">
          <mat-icon>groups</mat-icon>
          <p>No family members yet. Add the first one to get started.</p>
        </div>
      } @else {
        <div class="card-grid">
          @for (m of members(); track m.id) {
            <mat-card class="member-card" (click)="open(m)">
              <mat-card-header>
                <div mat-card-avatar class="avatar">{{ initial(m.name) }}</div>
                <mat-card-title>{{ m.name }}</mat-card-title>
                <mat-card-subtitle>{{ m.relationship || '—' }}</mat-card-subtitle>
                <button
                  mat-icon-button
                  class="card-menu"
                  [matMenuTriggerFor]="menu"
                  (click)="$event.stopPropagation()"
                >
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <button mat-menu-item (click)="edit(m); $event.stopPropagation()">
                    <mat-icon>edit</mat-icon> Edit
                  </button>
                  <button mat-menu-item (click)="remove(m); $event.stopPropagation()">
                    <mat-icon>delete</mat-icon> Delete
                  </button>
                </mat-menu>
              </mat-card-header>
              <mat-card-content>
                <p class="muted">
                  @if (m.date_of_birth) {
                    Born {{ m.date_of_birth | date: 'mediumDate' }} · {{ age(m.date_of_birth) }} yrs
                  } @else {
                    No date of birth on file
                  }
                </p>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .member-card {
        cursor: pointer;
        transition: box-shadow 0.15s ease;
      }
      .member-card:hover {
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
      }
      .avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #00639b;
        color: #fff;
        font-weight: 500;
      }
      .card-menu {
        position: absolute;
        top: 8px;
        right: 8px;
      }
    `,
  ],
})
export class FamilyList {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  protected members = signal<FamilyMember[]>([]);
  protected loading = signal(true);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.listFamily().subscribe({
      next: (m) => {
        this.members.set(m);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  protected age(dob: string): number {
    const d = new Date(dob);
    const diff = Date.now() - d.getTime();
    return Math.max(0, Math.floor(diff / (365.25 * 86_400_000)));
  }

  protected open(m: FamilyMember): void {
    this.router.navigate(['/family', m.id]);
  }

  protected add(): void {
    this.dialog
      .open(MemberDialog, { data: {} })
      .afterClosed()
      .subscribe((res) => res && this.load());
  }

  protected edit(m: FamilyMember): void {
    this.dialog
      .open(MemberDialog, { data: { member: m } })
      .afterClosed()
      .subscribe((res) => res && this.load());
  }

  protected remove(m: FamilyMember): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Delete ${m.name}?`,
          message: 'This permanently removes the member and all of their records, schedule items, documents and alerts.',
          confirmLabel: 'Delete',
          danger: true,
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (ok) this.api.deleteFamilyMember(m.id).subscribe(() => this.load());
      });
  }
}
