import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected submitted = false;
  protected formData = {
    login: '',
    password: '',
    passwordConfirmation: '',
    lastName: '',
    firstName: '',
    email: '',
  };

  protected onSubmit(form: NgForm): void {
    if (form.invalid || this.formData.password !== this.formData.passwordConfirmation) {
      return;
    }

    this.submitted = true;
  }
}
