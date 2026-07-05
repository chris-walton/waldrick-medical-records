import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatListModule } from '@angular/material/list';
import { ApiService } from '../../core/api.service';
import { DatePrecision, ExtraField, FamilyMember, HealthRecord, RecordType } from '../../core/models';

export interface BulkImmunizationDialogData {
  members: FamilyMember[];
  recordTypes: RecordType[];
  /** Optionally pre-select some members (e.g. when opened from a member's page). */
  preselectedIds?: string[];
}

/**
 * Logs the SAME immunization (shot) for one or more family members in a single step —
 * for the common case of the family getting shots together. Creates one immunization
 * record per selected member with the shared date / provider / lot details.
 */
@Component({
  selector: 'app-bulk-immunization-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatListModule,
  ],
  template: `
    <h2 mat-dialog-title>Log shots</h2>
    <mat-dialog-content>
      <form class="dialog-form">
        <div class="members">
          <div class="members-head">
            <span class="section-label">Who got this shot?</span>
            <button mat-button type="button" (click)="toggleAll()">
              {{ allSelected() ? 'Clear' : 'Select all' }}
            </button>
          </div>
          <mat-selection-list [(ngModel)]="selectedIds" name="members">
            @for (m of data.members; track m.id) {
              <mat-list-option [value]="m.id" togglePosition="before">
                <span class="member-dot" [style.background]="m.color || '#00639b'"></span>
                {{ m.name }}
              </mat-list-option>
            }
          </mat-selection-list>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Vaccine / type</mat-label>
          <input matInput [(ngModel)]="title" name="title" required placeholder="e.g. Flu shot" />
        </mat-form-field>

        <div class="date-field">
          <mat-button-toggle-group
            class="precision-toggle"
            [value]="precision()"
            (change)="setPrecision($event.value)"
            aria-label="How much of the date is known"
          >
            <mat-button-toggle value="day">Exact date</mat-button-toggle>
            <mat-button-toggle value="month">Month &amp; year</mat-button-toggle>
            <mat-button-toggle value="year">Year only</mat-button-toggle>
          </mat-button-toggle-group>

          <mat-form-field appearance="outline">
            <mat-label>{{ dateLabel() }}</mat-label>
            @switch (precision()) {
              @case ('year') {
                <input
                  matInput
                  type="text"
                  inputmode="numeric"
                  maxlength="4"
                  placeholder="e.g. 2015"
                  [(ngModel)]="dateInput"
                  name="date"
                />
              }
              @case ('month') {
                <input matInput type="month" [(ngModel)]="dateInput" name="date" />
              }
              @default {
                <input matInput type="date" [(ngModel)]="dateInput" name="date" />
              }
            }
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Provider</mat-label>
          <input matInput [(ngModel)]="provider" name="provider" placeholder="Doctor / clinic / pharmacy" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Location / where</mat-label>
          <input matInput [(ngModel)]="location" name="location" />
        </mat-form-field>

        @for (f of extraFields(); track f.key) {
          <mat-form-field appearance="outline">
            <mat-label>{{ f.label }}</mat-label>
            <input matInput [type]="f.type" [(ngModel)]="extra[f.key]" [name]="f.key" />
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>Notes</mat-label>
          <textarea matInput rows="2" [(ngModel)]="notes" name="notes"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!canSave() || saving()"
        (click)="save()"
      >
        {{ saving() ? 'Saving…' : saveLabel() }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .members {
        margin-bottom: 4px;
      }
      .members-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .section-label {
        font-size: 0.85rem;
        color: #5f6368;
      }
      mat-selection-list {
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 8px;
        padding: 4px 0;
      }
      .member-dot {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        margin-right: 8px;
        vertical-align: middle;
      }
      .date-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 4px;
      }
      .precision-toggle {
        align-self: flex-start;
        max-width: 100%;
      }
    `,
  ],
})
export class BulkImmunizationDialog {
  private api = inject(ApiService);
  private ref = inject(MatDialogRef<BulkImmunizationDialog>);
  protected data = inject<BulkImmunizationDialogData>(MAT_DIALOG_DATA);

  protected saving = signal(false);

  private readonly immunizationType =
    this.data.recordTypes.find((t) => t.key === 'immunization') ?? this.data.recordTypes[0];

  protected selectedIds: string[] = this.data.preselectedIds ?? [];
  protected title = '';
  protected provider: string | null = null;
  protected location: string | null = null;
  protected notes: string | null = null;
  protected extra: Record<string, string> = {};

  protected precision = signal<DatePrecision>('day');
  protected dateInput = this.today();

  protected readonly extraFields = computed<ExtraField[]>(() => {
    if (!this.immunizationType?.schema_json) return [];
    try {
      return JSON.parse(this.immunizationType.schema_json) as ExtraField[];
    } catch {
      return [];
    }
  });

  protected dateLabel = computed<string>(() => {
    switch (this.precision()) {
      case 'year':
        return 'Year';
      case 'month':
        return 'Month & year';
      default:
        return 'Date';
    }
  });

  protected allSelected(): boolean {
    return this.data.members.length > 0 && this.selectedIds.length === this.data.members.length;
  }

  protected canSave(): boolean {
    return !!this.title.trim() && !!this.immunizationType && this.selectedIds.length > 0;
  }

  protected saveLabel(): string {
    const n = this.selectedIds.length;
    return n > 1 ? `Log ${n} shots` : 'Log shot';
  }

  protected toggleAll(): void {
    this.selectedIds = this.allSelected() ? [] : this.data.members.map((m) => m.id);
  }

  protected setPrecision(p: DatePrecision): void {
    this.dateInput = this.truncate(this.expand() ?? '', p);
    this.precision.set(p);
  }

  protected save(): void {
    if (!this.canSave() || !this.immunizationType) return;
    this.saving.set(true);

    const cleanExtra: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.extra)) {
      if (v !== null && v !== undefined && `${v}`.trim() !== '') cleanExtra[k] = v;
    }
    const base: Partial<HealthRecord> = {
      record_type_id: this.immunizationType.id,
      title: this.title.trim(),
      event_date: this.expand(),
      date_precision: this.precision(),
      provider: this.provider,
      location: this.location,
      notes: this.notes,
      data_json: Object.keys(cleanExtra).length ? JSON.stringify(cleanExtra) : null,
    };

    forkJoin(
      this.selectedIds.map((id) => this.api.createRecord({ ...base, family_member_id: id })),
    ).subscribe({
      next: (records) => this.ref.close(records),
      error: () => this.saving.set(false),
    });
  }

  /** Today's date as YYYY-MM-DD (local), for the common "logging a shot today" case. */
  private today(): string {
    const d = new Date();
    const pad = (n: number) => `${n}`.padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Cut a full ISO date down to what the given precision's input shows. */
  private truncate(date: string, p: DatePrecision): string {
    if (!date) return '';
    return date.slice(0, p === 'year' ? 4 : p === 'month' ? 7 : 10);
  }

  /** Grow the current input back to a full ISO date, or null if empty/invalid. */
  private expand(): string | null {
    const v = (this.dateInput ?? '').trim();
    if (!v) return null;
    switch (this.precision()) {
      case 'year':
        return /^\d{4}$/.test(v) ? `${v}-01-01` : null;
      case 'month':
        return /^\d{4}-\d{2}$/.test(v) ? `${v}-01` : null;
      default:
        return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    }
  }
}
