import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ApiService } from '../../core/api.service';
import { DatePrecision, ExtraField, HealthRecord, RecordType } from '../../core/models';

export interface RecordDialogData {
  record?: HealthRecord;
  familyMemberId?: string;
  recordTypes: RecordType[];
  /** When set, the type is fixed (e.g. the Immunizations tab) and the picker is hidden. */
  lockedTypeKey?: string;
}

@Component({
  selector: 'app-record-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatButtonToggleModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ editing ? 'Edit' : 'Add' }} record</h2>
    <mat-dialog-content>
      <form class="dialog-form">
        @if (!locked) {
          <mat-form-field appearance="outline">
            <mat-label>Type</mat-label>
            <mat-select [ngModel]="typeId()" name="type" (ngModelChange)="selectType($event)">
              @for (t of data.recordTypes; track t.id) {
                <mat-option [value]="t.id">{{ t.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>{{ titleLabel() }}</mat-label>
          <input matInput [(ngModel)]="model.title" name="title" required />
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
                  pattern="d{4}"
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
          <input
            matInput
            [(ngModel)]="model.provider"
            name="provider"
            placeholder="Doctor / clinic"
          />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Location / where</mat-label>
          <input matInput [(ngModel)]="model.location" name="location" />
        </mat-form-field>

        @for (f of extraFields(); track f.key) {
          <mat-form-field appearance="outline">
            <mat-label>{{ f.label }}</mat-label>
            @if (f.type === 'textarea') {
              <textarea matInput rows="2" [(ngModel)]="extra[f.key]" [name]="f.key"></textarea>
            } @else {
              <input matInput [type]="f.type" [(ngModel)]="extra[f.key]" [name]="f.key" />
            }
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>Notes</mat-label>
          <textarea matInput rows="2" [(ngModel)]="model.notes" name="notes"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!model.title || !typeId() || saving()"
        (click)="save()"
      >
        {{ saving() ? 'Saving…' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
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
export class RecordDialog {
  private api = inject(ApiService);
  private ref = inject(MatDialogRef<RecordDialog>);
  protected data = inject<RecordDialogData>(MAT_DIALOG_DATA);

  protected readonly editing = !!this.data.record;
  protected saving = signal(false);

  private readonly lockedType = this.data.lockedTypeKey
    ? this.data.recordTypes.find((t) => t.key === this.data.lockedTypeKey)
    : undefined;
  protected readonly locked = !!this.lockedType;

  protected typeId = signal<string>(
    this.data.record?.record_type_id ?? this.lockedType?.id ?? this.data.recordTypes[0]?.id ?? '',
  );

  protected model: Partial<HealthRecord> = {
    title: this.data.record?.title ?? '',
    provider: this.data.record?.provider ?? null,
    location: this.data.record?.location ?? null,
    notes: this.data.record?.notes ?? null,
  };

  // How much of the date is known, and the value shown in the (day/month/year) input.
  protected precision = signal<DatePrecision>(this.data.record?.date_precision ?? 'day');
  protected dateInput = this.truncate(
    this.data.record?.event_date ?? '',
    this.data.record?.date_precision ?? 'day',
  );

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

  protected extra: Record<string, string> = this.parseData(this.data.record?.data_json);

  protected readonly extraFields = computed<ExtraField[]>(() => {
    const t = this.data.recordTypes.find((rt) => rt.id === this.typeId());
    if (!t?.schema_json) return [];
    try {
      return JSON.parse(t.schema_json) as ExtraField[];
    } catch {
      return [];
    }
  });

  protected titleLabel = computed<string>(() => {
    const t = this.data.recordTypes.find((rt) => rt.id === this.typeId());
    if (t?.key === 'immunization') return 'Vaccine / type';
    if (t?.key === 'medication') return 'Medication';
    return 'Title';
  });

  protected setPrecision(p: DatePrecision): void {
    // Trim the finer parts the new precision no longer captures (e.g. day -> year drops the month/day).
    this.dateInput = this.truncate(this.expand() ?? '', p);
    this.precision.set(p);
  }

  protected selectType(id: string): void {
    this.typeId.set(id);
    // Drop extra values that don't belong to the newly selected type.
    const keep = new Set(this.extraFields().map((f) => f.key));
    for (const k of Object.keys(this.extra)) {
      if (!keep.has(k)) delete this.extra[k];
    }
  }

  protected save(): void {
    if (!this.model.title || !this.typeId()) return;
    this.saving.set(true);
    const cleanExtra: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.extra)) {
      if (v !== null && v !== undefined && `${v}`.trim() !== '') cleanExtra[k] = v;
    }
    const body: Partial<HealthRecord> = {
      ...this.model,
      event_date: this.expand(),
      date_precision: this.precision(),
      record_type_id: this.typeId(),
      data_json: Object.keys(cleanExtra).length ? JSON.stringify(cleanExtra) : null,
    };
    const req = this.editing
      ? this.api.updateRecord(this.data.record!.id, body)
      : this.api.createRecord({ ...body, family_member_id: this.data.familyMemberId });
    req.subscribe({
      next: (r) => this.ref.close(r),
      error: () => this.saving.set(false),
    });
  }

  /** Cut a stored full ISO date down to what the given precision's input shows. */
  private truncate(date: string, p: DatePrecision): string {
    if (!date) return '';
    return date.slice(0, p === 'year' ? 4 : p === 'month' ? 7 : 10);
  }

  /** Grow the current input back to a full ISO date (start of the known period), or null if empty/invalid. */
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

  private parseData(json: string | null | undefined): Record<string, string> {
    if (!json) return {};
    try {
      const obj = JSON.parse(json);
      return obj && typeof obj === 'object' ? obj : {};
    } catch {
      return {};
    }
  }
}
