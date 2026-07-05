import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../core/api.service';
import { FamilyMember } from '../../core/models';

export interface MemberDialogData {
  member?: FamilyMember;
}

@Component({
  selector: 'app-member-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ editing ? 'Edit' : 'Add' }} family member</h2>
    <mat-dialog-content>
      <form class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput [(ngModel)]="model.name" name="name" required />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Relationship</mat-label>
          <mat-select [(ngModel)]="model.relationship" name="relationship">
            <mat-option [value]="null">—</mat-option>
            @for (r of relationships; track r) {
              <mat-option [value]="r">{{ r }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Date of birth</mat-label>
          <input matInput type="date" [(ngModel)]="model.date_of_birth" name="dob" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Sex</mat-label>
          <mat-select [(ngModel)]="model.sex" name="sex">
            <mat-option [value]="null">—</mat-option>
            <mat-option value="Female">Female</mat-option>
            <mat-option value="Male">Male</mat-option>
            <mat-option value="Other">Other</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Blood type</mat-label>
          <input matInput [(ngModel)]="model.blood_type" name="blood" placeholder="e.g. O+" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Notes</mat-label>
          <textarea matInput rows="2" [(ngModel)]="model.notes" name="notes"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!model.name || saving()" (click)="save()">
        {{ saving() ? 'Saving…' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class MemberDialog {
  private api = inject(ApiService);
  private ref = inject(MatDialogRef<MemberDialog>);
  private data = inject<MemberDialogData>(MAT_DIALOG_DATA);

  protected readonly relationships = ['Self', 'Spouse', 'Child', 'Parent', 'Other'];
  protected readonly editing = !!this.data.member;
  protected saving = signal(false);

  protected model: Partial<FamilyMember> = {
    name: this.data.member?.name ?? '',
    relationship: this.data.member?.relationship ?? null,
    date_of_birth: this.data.member?.date_of_birth ?? null,
    sex: this.data.member?.sex ?? null,
    blood_type: this.data.member?.blood_type ?? null,
    notes: this.data.member?.notes ?? null,
  };

  protected save(): void {
    if (!this.model.name) return;
    this.saving.set(true);
    const req = this.editing
      ? this.api.updateFamilyMember(this.data.member!.id, this.model)
      : this.api.createFamilyMember(this.model);
    req.subscribe({
      next: (m) => this.ref.close(m),
      error: () => this.saving.set(false),
    });
  }
}
